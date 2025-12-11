const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// Load Firebase service account
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ---------------------------------------------
// TEST ROUTE
// ---------------------------------------------
app.get("/", (req, res) => {
  res.send("NutriTrack Backend Running ✔");
});

// ---------------------------------------------
// USDA NUTRITION LOOKUP
// ---------------------------------------------
app.get("/nutrition/:query", async (req, res) => {
  const food = req.params.query;

  try {
    const response = await axios.get(
      `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${process.env.USDA_API_KEY}&query=${food}`
    );

    res.json(response.data);
  } catch (error) {
    console.error("USDA API Error:", error.message);
    res.status(500).json({ error: "USDA API error" });
  }
});

// ---------------------------------------------
// SAVE MEAL LOG
// ---------------------------------------------
app.post("/meals", async (req, res) => {
  try {
    const { uid, food, calories } = req.body;

    if (!uid || !food || !calories) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await db.collection("meals").add({
      uid,
      food,
      calories,
      createdAt: new Date()
    });

    res.json({ message: "Meal saved successfully" });
  } catch (error) {
    console.error("Meal Save Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------
// REGISTER USER
// ---------------------------------------------
app.post("/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Create Firebase Auth user
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name
    });

    // Save user profile in Firestore
    await db.collection("users").doc(userRecord.uid).set({
      email,
      name,
      createdAt: new Date()
    });

    res.json({ message: "User registered", uid: userRecord.uid });
  } catch (error) {
    console.error("Register Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------
// LOGIN USER (GENERATE CUSTOM TOKEN)
// ---------------------------------------------
app.post("/login", async (req, res) => {
  const { uid } = req.body;

  try {
    if (!uid) return res.status(400).json({ error: "UID required" });

    const token = await admin.auth().createCustomToken(uid);
    res.json({ token });
  } catch (error) {
    console.error("Login Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------
// START SERVER
// ---------------------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
