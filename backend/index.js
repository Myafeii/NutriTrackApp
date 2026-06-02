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

app.post("/recognize-food", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "No image uploaded",
      });
    }

    const base64Image = req.file.buffer.toString("base64");

    const geminiResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: req.file.mimetype,
            data: base64Image,
          },
        },
        {
          text: "Identify the main food in this image. Return only the food name.",
        },
      ],
    });

    const detectedFood = geminiResponse.text.trim();

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

    const food = usdaResponse.data.foods[0];

    const calories =
      food.foodNutrients.find((n) => n.nutrientId === 1008)?.value || 0;

    const protein =
      food.foodNutrients.find((n) => n.nutrientId === 1003)?.value || 0;

    const carbs =
      food.foodNutrients.find((n) => n.nutrientId === 1005)?.value || 0;

    const fat =
      food.foodNutrients.find((n) => n.nutrientId === 1004)?.value || 0;

    res.json({
      detectedFood,
      calories,
      protein,
      carbs,
      fat,
    });
  } catch (error) {
    console.error(
      "Food Recognition Error:",
      error.response?.data || error.message,
    );

    res.status(500).json({
      error: "Food recognition failed",
      details: error.response?.data || error.message,
    });
  }
});

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
            const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime();
            const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime();
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
            return res.status(500).json({ error: "Missing FIREBASE_WEB_API_KEY in .env" });
        }

        const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${process.env.FIREBASE_WEB_API_KEY}`;

        await axios.post(url, { requestType: "PASSWORD_RESET", email });

        return res.json({ message: "Password reset email sent." });
    } catch (err) {
        console.error("Reset Password Error:", err.response?.data || err.message);
        return res.status(500).json({ error: "Reset password failed", details: err.response?.data || err.message });
    }
});
// =====================================================
// START SERVER
// =====================================================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Backend running on port", PORT);
});
