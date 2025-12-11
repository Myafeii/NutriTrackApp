const express = require("express");
const auth = require("../middleware/auth");
const { db } = require("../firebase");

const router = express.Router();

function dateString(date) {
  return date.toISOString().substring(0, 10);
}

router.get("/streak", auth, async (req, res) => {
  const uid = req.user.uid;

  try {
    const snap = await db.collection("meals").where("userId", "==", uid).get();

    const days = new Set();
    snap.forEach((doc) => days.add(doc.data().date));

    let streak = 0;
    let d = new Date();

    while (days.has(dateString(d))) {
      streak++;
      d.setDate(d.getDate() - 1);
    }

    res.json({ streak });
  } catch (err) {
    res.status(500).json({ message: "Streak calc failed" });
  }
});

module.exports = router;
