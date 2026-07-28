const multer = require("multer");
const { GoogleGenAI } = require("@google/genai");
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// Firebase Service Account
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
function isStrongPassword(password) {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
  return regex.test(password);
}

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
  },
});

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// =====================================================
// TEST ROUTE
// =====================================================
app.get("/", (req, res) => {
  res.send("NutriTrack Backend Running ✔");
});

// =====================================================
// USDA NUTRITION SEARCH
// =====================================================
app.get("/nutrition/:query", async (req, res) => {
  const food = req.params.query;

  try {
    console.log("Searching USDA for:", food);
    console.log("USDA key loaded:", process.env.USDA_API_KEY ? "YES" : "NO");

    const response = await axios.get(
      "https://api.nal.usda.gov/fdc/v1/foods/search",
      {
        params: {
          query: food,
          api_key: process.env.USDA_API_KEY,
          pageSize: 10,
        },
      },
    );

    res.json(response.data);
  } catch (error) {
    console.error("USDA API Error Status:", error.response?.status);

    console.error("USDA API Details:", error.response?.data || error.message);

    res.status(500).json({
      error: "USDA API error",
      details: error.response?.data || error.message,
    });
  }
});

// =====================================================
// AI FOOD IMAGE RECOGNITION
// =====================================================
app.post(
  "/recognize-food",
  upload.array("images", 5),
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          error: "No images uploaded",
        });
      }

      const allowedImageTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
      ];

      const results = [];

      for (const file of req.files) {
        if (!allowedImageTypes.includes(file.mimetype)) {
          results.push({
            fileName: file.originalname,
            error: "Only JPEG, PNG, and WebP images are supported.",
          });

          continue;
        }

        const base64Image = file.buffer.toString("base64");

        const geminiResponse = await ai.models.generateContent({
          model: "gemini-2.5-flash",

          contents: [
            {
              inlineData: {
                mimeType: file.mimetype,
                data: base64Image,
              },
            },
            {
              text: `
                Analyze this image and identify the main food item.

                Return:
                1. The main food name.
                2. A confidence estimate from 0 to 100.

                If no food is clearly visible, return:
                food: "Unknown"
                confidence: 0
              `,
            },
          ],

          config: {
            responseMimeType: "application/json",

            responseJsonSchema: {
              type: "object",

              properties: {
                food: {
                  type: "string",
                  description:
                    "The main food item identified in the image.",
                },

                confidence: {
                  type: "integer",
                  minimum: 0,
                  maximum: 100,
                  description:
                    "An estimated confidence score from 0 to 100.",
                },
              },

              required: ["food", "confidence"],
            },
          },
        });

        const recognition = JSON.parse(geminiResponse.text);

        const detectedFood = recognition.food?.trim();
        const confidence = Number(recognition.confidence);

        if (
          !detectedFood ||
          detectedFood.toLowerCase() === "unknown" ||
          !Number.isFinite(confidence) ||
          confidence < 40
        ) {
          results.push({
            fileName: file.originalname,
            detectedFood: detectedFood || "Unknown",
            confidence: Number.isFinite(confidence)
              ? confidence
              : 0,
            error:
              "The food could not be identified confidently.",
          });

          continue;
        }

        const usdaResponse = await axios.get(
          "https://api.nal.usda.gov/fdc/v1/foods/search",
          {
            params: {
              query: detectedFood,
              api_key: process.env.USDA_API_KEY,
              pageSize: 1,
            },
          },
        );

        if (!usdaResponse.data.foods?.length) {
          results.push({
            fileName: file.originalname,
            detectedFood,
            confidence,
            error:
              "No USDA nutrition information was found.",
          });

          continue;
        }

        const food = usdaResponse.data.foods[0];

        const getNutrientValue = (nutrientId) =>
          food.foodNutrients.find(
            (nutrient) => nutrient.nutrientId === nutrientId,
          )?.value ?? 0;

        results.push({
          fileName: file.originalname,
          detectedFood,
          confidence,
          calories: getNutrientValue(1008),
          protein: getNutrientValue(1003),
          carbs: getNutrientValue(1005),
          fat: getNutrientValue(1004),
        });
      }

      return res.json({
        imageCount: req.files.length,
        results,
      });
    } catch (error) {
      console.error(
        "Food Recognition Error:",
        error.response?.data || error.message,
      );

      return res.status(500).json({
        error: "Food recognition failed",
        details: error.response?.data || error.message,
      });
    }
  },
);

// =====================================================
// SAVE MEAL
// =====================================================
app.post("/meals", async (req, res) => {
  try {
    const { uid, food, calories } = req.body;

    if (!uid || !food || calories == null) {
      return res.status(400).json({
        error: "Missing required fields",
      });
    }

    const docRef = await db.collection("meals").add({
      uid,
      food,
      calories,
      createdAt: new Date(),
    });

    res.json({
      message: "Meal saved successfully",
      id: docRef.id,
    });
  } catch (error) {
    console.error("Meal Save Error:", error.message);

    res.status(500).json({
      error: error.message,
    });
  }
});

app.get("/meals", async (req, res) => {
  try {
    const { uid } = req.query;
    if (!uid) return res.status(400).json({ error: "uid is required" });

    const snap = await db.collection("meals").where("uid", "==", uid).get();

    const meals = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        uid: data.uid,
        food: data.food,
        calories: data.calories,
        createdAt: data.createdAt,
      };
    });

    // newest first
    meals.sort((a, b) => {
      const ta = a.createdAt?.toDate
        ? a.createdAt.toDate().getTime()
        : new Date(a.createdAt).getTime();
      const tb = b.createdAt?.toDate
        ? b.createdAt.toDate().getTime()
        : new Date(b.createdAt).getTime();
      return tb - ta;
    });

    return res.json({ meals });
  } catch (err) {
    console.error("Get Meals Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.delete("/meals/:id", async (req, res) => {
  try {
    const mealId = req.params.id;
    const uid = req.query.uid;

    if (!mealId || !uid) {
      return res.status(400).json({ error: "mealId and uid required" });
    }

    const ref = db.collection("meals").doc(mealId);
    const snap = await ref.get();

    if (!snap.exists) return res.status(404).json({ error: "Meal not found" });

    const data = snap.data();
    if (data.uid !== uid) return res.status(403).json({ error: "Not allowed" });

    await ref.delete();
    return res.json({ message: "Meal deleted" });
  } catch (err) {
    console.error("Delete Meal Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// =====================================================
// REGISTER USER
// =====================================================
app.post("/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        error: "Missing required fields",
      });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        error:
          "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.",
      });
    }

    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
      emailVerified: false,
    });

    await db.collection("users").doc(userRecord.uid).set({
      email,
      name,
      createdAt: new Date(),
    });

    const customToken = await admin.auth().createCustomToken(userRecord.uid);

    const signInResponse = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.FIREBASE_WEB_API_KEY}`,
      {
        token: customToken,
        returnSecureToken: true,
      },
    );

    await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${process.env.FIREBASE_WEB_API_KEY}`,
      {
        requestType: "VERIFY_EMAIL",
        idToken: signInResponse.data.idToken,
      },
    );

    res.json({
      message: "User registered. Verification email sent.",
      uid: userRecord.uid,
      email,
      name,
    });
  } catch (error) {
    console.error("Register Error:", error.response?.data || error.message);

    res.status(500).json({
      error: error.response?.data?.error?.message || error.message,
    });
  }
});

// =====================================================
// LOGIN USER
// =====================================================
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    const response = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_WEB_API_KEY}`,
      {
        email,
        password,
        returnSecureToken: true,
      },
    );

    const lookupResponse = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.FIREBASE_WEB_API_KEY}`,
      {
        idToken: response.data.idToken,
      },
    );

    const firebaseUser = lookupResponse.data.users[0];

    if (!firebaseUser.emailVerified) {
      return res.status(403).json({
        error: "Please verify your email before logging in.",
      });
    }

    const uid = response.data.localId;

    const userDoc = await db.collection("users").doc(uid).get();

    let name = "User";

    if (userDoc.exists && userDoc.data().name) {
      name = userDoc.data().name;
    }

    res.json({
      message: "Login successful",
      uid,
      email: response.data.email,
      name,
      idToken: response.data.idToken,
    });
  } catch (error) {
    console.error("Login Error:", error.response?.data || error.message);

    res.status(401).json({
      error:
        error.response?.data?.error?.message || "Invalid email or password",
    });
  }
});

app.post("/reset-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) return res.status(400).json({ error: "Email is required" });
    if (!process.env.FIREBASE_WEB_API_KEY) {
      return res
        .status(500)
        .json({ error: "Missing FIREBASE_WEB_API_KEY in .env" });
    }

    const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${process.env.FIREBASE_WEB_API_KEY}`;

    await axios.post(url, { requestType: "PASSWORD_RESET", email });

    return res.json({ message: "Password reset email sent." });
  } catch (err) {
    console.error("Reset Password Error:", err.response?.data || err.message);
    return res
      .status(500)
      .json({
        error: "Reset password failed",
        details: err.response?.data || err.message,
      });
  }
});

// =====================================================
// BARCODE SCANNER
// =====================================================

app.get("/barcode/:barcode", async (req, res) => {
  try {
    const barcode = req.params.barcode?.trim();

    if (!barcode) {
      return res.status(400).json({
        error: "Barcode is required",
      });
    }

    const response = await axios.get(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
    );

    if (!response.data || response.data.status !== 1) {
      return res.status(404).json({
        error: "Product not found",
      });
    }

    const product = response.data.product;
    const nutrients = product.nutriments || {};

    const result = {
      barcode,
      name:
        product.product_name || product.product_name_en || "Unknown Product",

      brand: product.brands || "Unknown Brand",

      imageUrl: product.image_front_url || product.image_url || null,

      servingSize: product.serving_size || "100 g",

      calories:
        nutrients["energy-kcal_serving"] ?? nutrients["energy-kcal_100g"] ?? 0,

      protein: nutrients.proteins_serving ?? nutrients.proteins_100g ?? 0,

      carbohydrates:
        nutrients.carbohydrates_serving ?? nutrients.carbohydrates_100g ?? 0,

      fat: nutrients.fat_serving ?? nutrients.fat_100g ?? 0,

      sugar: nutrients.sugars_serving ?? nutrients.sugars_100g ?? 0,

      sodium: nutrients.sodium_serving ?? nutrients.sodium_100g ?? 0,
    };

    res.json(result);
  } catch (error) {
    console.error(
      "Barcode lookup error:",
      error.response?.data || error.message,
    );

    res.status(500).json({
      error: "Unable to retrieve product information",
    });
  }
});
// =====================================================
// START SERVER
// =====================================================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Backend running on port", PORT);
});
