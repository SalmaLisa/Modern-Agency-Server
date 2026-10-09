
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const connectDB = require("./models/config");

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
  })
);

app.use(express.json({ limit: "1mb" }));

const contentSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: "homepage" },
    content: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

const WebsiteContent =
  mongoose.models.WebsiteContent ||
  mongoose.model("WebsiteContent", contentSchema);

app.get("/api/website-content", async (req, res) => {
  try {
    const doc = await WebsiteContent.findOne({ key: "homepage" });
    res.json(doc ? doc.content : null);
  } catch (error) {
    res.status(500).json({ message: "Failed to load content" });
  }
});

app.put("/api/website-content", async (req, res) => {
  try {
    const doc = await WebsiteContent.findOneAndUpdate(
      { key: "homepage" },
      { $set: { content: req.body } },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({
      message: "Content saved successfully",
      content: doc.content,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to save content" });
  }
});

async function startServer() {
  await connectDB();

  app.listen(process.env.PORT || 5000, () => {
    console.log(`{API running at http://localhost:${process.env.PORT}}`);
  });
}

startServer();