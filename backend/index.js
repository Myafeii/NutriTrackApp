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

    await db.collection("meals").add({
      uid,
      food,
      calories,
      createdAt: new Date(),
    });

    res.json({
      message: "Meal saved successfully",
    });
  } catch (error) {
    console.error("Meal Save Error:", error.message);

    res.status(500).json({
      error: error.message,
    });
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

    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
    });

    await db.collection("users").doc(userRecord.uid).set({
      email,
      name,
      createdAt: new Date(),
    });

    res.json({
      message: "User registered successfully",
      uid: userRecord.uid,
      email,
      name,
    });
  } catch (error) {
    console.error("Register Error:", error.message);

    res.status(500).json({
      error: error.message,
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
      error: "Invalid email or password",
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
