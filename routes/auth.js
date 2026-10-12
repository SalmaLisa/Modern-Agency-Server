
const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const router = express.Router();

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Validate required fields
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    // 2. Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // 3. Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        message: "Please provide a valid email address.",
      });
    }

    // 4. Validate password length
    // Count UTF-8 bytes because bcrypt has a 72-byte input limit.
    if (Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({
        message: "Password must not exceed 72 bytes.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must contain at least 8 characters.",
      });
    }

    // 5. Check whether the email is already registered
    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    // 6. Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 12);

    // 7. Create a client account
    // The client cannot choose their own role.
    const user = await User.create({
      email: normalizedEmail,
      password: hashedPassword,
      role: "client",
      emailVerified: false,
    });

    // 8. Return safe information only
    return res.status(201).json({
      message: "Registration successful. Email verification is not implemented yet.",
      user: {
        id: user._id,
        email: user.email,
        emailVerified: user.emailVerified,
        role: user.role,
      },
    });
  } catch (error) {
    // Handle concurrent registrations using the same email
    if (error.code === 11000) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    console.error("Registration error:", error.message);

    return res.status(500).json({
      message: "Registration failed. Please try again later.",
    });
  }
});
// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Password is select:false in the User model,
    // so explicitly request it for password comparison.
    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    // Email verification will be enforced in a later step.
    // Regenerate the session ID to help prevent session fixation.
    req.session.regenerate((error) => {
      if (error) {
        console.error("Session regeneration failed:", error.message);

        return res.status(500).json({
          message: "Unable to log in. Please try again.",
        });
      }

      req.session.userId = user._id.toString();

      req.session.save((saveError) => {
        if (saveError) {
          console.error("Session save failed:", saveError.message);

          return res.status(500).json({
            message: "Unable to log in. Please try again.",
          });
        }

        return res.status(200).json({
          message: "Login successful.",
          user: {
            id: user._id,
            email: user.email,
            role: user.role,
            emailVerified: user.emailVerified,
          },
        });
      });
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      message: "Login failed. Please try again later.",
    });
  }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error("Logout error:", error.message);

      return res.status(500).json({
        message: "Unable to log out. Please try again.",
      });
    }

    res.clearCookie("agency.sid", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite:
        process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
    });

    return res.status(200).json({
      message: "Logout successful.",
    });
  });
});

/* GET /api/auth/me */
router.get("/me", async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({
        message: "You are not logged in.",
      });
    }

    const user = await User.findById(req.session.userId).select(
      "_id email role emailVerified"
    );

    if (!user) {
      req.session.destroy(() => {});

      return res.status(401).json({
        message: "User account not found.",
      });
    }

    return res.status(200).json({
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    console.error("Session check error:", error.message);

    return res.status(500).json({
      message: "Unable to verify your session.",
    });
  }
});

module.exports = router;
