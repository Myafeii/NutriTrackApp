const express = require("express");
const auth = require("../middleware/auth");
const { db } = require("../firebase");

const router = express.Router();

router.post("/", auth, async (req, res) => {
  const uid = req.user.uid;
  const { message } = req.body;

  if (!message) return res.status(400).json({ message: "Message required" });

  try {
    await db.collection("communityPosts").add({
      userId: uid,
      message,
      createdAt: new Date(),
    });
    res.json({ message: "Post added" });
  } catch (err) {
    res.status(500).json({ message: "Error posting" });
  }
});

router.get("/", auth, async (req, res) => {
  try {
    const snap = await db
      .collection("communityPosts")
      .orderBy("createdAt", "desc")
      .limit(25)
      .get();

    res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (err) {
    res.status(500).json({ message: "Error loading posts" });
  }
});

module.exports = router;
