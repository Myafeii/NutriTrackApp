require("dotenv").config();
const express = require("express");
const cors = require("cors");

const mealsRouter = require("./routes/meals");
const communityRouter = require("./routes/community");
const statsRouter = require("./routes/stats");
const recommendationsRouter = require("./routes/recommendations");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "NutriTrack API running" });
});

app.use("/api/meals", mealsRouter);
app.use("/api/community", communityRouter);
app.use("/api/stats", statsRouter);
app.use("/api/recommendations", recommendationsRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`NutriTrack API listening on port ${PORT}`);
});
