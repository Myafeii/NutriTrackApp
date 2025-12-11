const express = require("express");
const auth = require("../middleware/auth");
const { db } = require("../firebase");

const router = express.Router();

const GOAL = 2000;

router.get("/today", auth, async (req, res) => {
  const uid = req.user.uid;

  try {
    const snap = await db.collection("meals").where("userId", "==", uid).get();

    let calories = 0;
    snap.forEach((doc) => {
      calories += doc.data().totals.calories || 0;
    });

    const tips = [];

    if (calories < GOAL * 0.5)
      tips.push("Eat more today, you're far below your target.");
    if (calories > GOAL * 1.1)
      tips.push("You've exceeded your calorie goal — eat lighter meals.");
    if (!tips.length) tips.push("Good balance today!");

    res.json({ calories, tips });
  } catch (err) {
    res.status(500).json({ message: "Failed to load recommendations" });
  }
});

module.exports = router;
