const express = require("express");
const axios = require("axios");
const auth = require("../middleware/auth");
const { db } = require("../firebase");

const router = express.Router();

function todayString() {
  return new Date().toISOString().substring(0, 10);
}

router.post("/search", auth, async (req, res) => {
  const { query } = req.body;

  if (!query) return res.status(400).json({ message: "query is required" });

  try {
    const params = {
      app_id: process.env.EDAMAM_ID,
      app_key: process.env.EDAMAM_KEY,
      ingr: query,
    };

    const { data } = await axios.get(
      "https://api.edamam.com/api/nutrition-data",
      { params }
    );

    res.json({
      calories: data.calories || 0,
      protein: data.totalNutrients?.PROCNT?.quantity || 0,
      carbs: data.totalNutrients?.CHOCDF?.quantity || 0,
      fat: data.totalNutrients?.FAT?.quantity || 0,
    });
  } catch (err) {
    console.error("Edamam error:", err);
    res.status(500).json({ message: "Edamam failed" });
  }
});

router.post("/", auth, async (req, res) => {
  const uid = req.user.uid;
  const { items, totals, date } = req.body;

  if (!items || !totals)
    return res.status(400).json({ message: "Missing meal data" });

  try {
    const doc = await db.collection("meals").add({
      userId: uid,
      date: date || todayString(),
      items,
      totals,
      createdAt: new Date(),
    });
    res.json({ id: doc.id, message: "Meal saved" });
  } catch (err) {
    res.status(500).json({ message: "Error saving meal" });
  }
});

router.get("/today", auth, async (req, res) => {
  const uid = req.user.uid;
  const today = todayString();

  try {
    const snapshot = await db
      .collection("meals")
      .where("userId", "==", uid)
      .where("date", "==", today)
      .get();

    let totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };

    snapshot.forEach((doc) => {
      const m = doc.data().totals;
      totals.calories += m.calories || 0;
      totals.protein += m.protein || 0;
      totals.carbs += m.carbs || 0;
      totals.fat += m.fat || 0;
    });

    res.json({ date: today, totals });
  } catch (err) {
    res.status(500).json({ message: "Failed to load meals" });
  }
});

module.exports = router;
