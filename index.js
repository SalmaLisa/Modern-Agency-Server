
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const connectDB = require("./models/config");
const authRoutes = require("./routes/auth");
const requireAuth = require("./middleware/requireAuth");

const app = express();

const isProduction = process.env.NODE_ENV === "production";

app.set("trust proxy", isProduction ? 1 : false);

const allowedOrigins = [
  process.env.CLIENT_URL?.replace(/\/+$/, ""),
  "http://localhost:3000",
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
  })
);


app.use(express.json({ limit: "1mb" }));

// Session configuration
app.use(
  session({
    name: "agency.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: "sessions",
      ttl: 24 * 60 * 60,
    }),
    cookie: {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  maxAge: 24 * 60 * 60 * 1000,
  path: "/",
},
  })
);

app.use("/api/auth", authRoutes);

// Existing website content schema
const contentSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      unique: true,
      default: "homepage",
    },
    content: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  { timestamps: true }
);

const WebsiteContent =
  mongoose.models.WebsiteContent ||
  mongoose.model("WebsiteContent", contentSchema);

// Get website content
app.get("/api/website-content", async (req, res) => {
  try {
    const doc = await WebsiteContent.findOne({
      key: "homepage",
    });

    res.json(doc ? doc.content : null);
  } catch (error) {
    console.error("Load content error:", error.message);

    res.status(500).json({
      message: "Failed to load content",
    });
  }
});

// Update website content
app.put("/api/website-content",requireAuth, async (req, res) => {
  try {
    const doc = await WebsiteContent.findOneAndUpdate(
      { key: "homepage" },
      { $set: { content: req.body } },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    );

    res.json({
      message: "Content saved successfully",
      content: doc.content,
    });
  } catch (error) {
    console.error("Save content error:", error.message);

    res.status(500).json({
      message: "Failed to save content",
    });
  }
});

async function startServer() {
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is required");
  }

  if (!process.env.CLIENT_URL) {
    throw new Error("CLIENT_URL is required");
  }

  await connectDB();

  app.listen(process.env.PORT || 5000, () => {
    console.log(
      `API running on port ${process.env.PORT || 5000}`
    );
  });
}

startServer().catch((error) => {
  console.error("Server startup failed:", error.message);
  process.exit(1);
});
