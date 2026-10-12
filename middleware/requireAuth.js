
const User = require("../models/User");

async function requireAuth(req, res, next) {
  try {
    // Check whether the user has a logged-in session.
    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        message: "Please log in to continue.",
      });
    }

    // Verify that the user still exists.
    const user = await User.findById(req.session.userId).select(
      "_id email role emailVerified"
    );

    if (!user) {
      req.session.destroy(() => {});

      return res.status(401).json({
        message: "Your session is no longer valid.",
      });
    }

    // Make the authenticated user available to the route.
    req.user = user;

    next();
  } catch (error) {
    console.error("Authentication error:", error.message);

    return res.status(500).json({
      message: "Unable to authenticate your request.",
    });
  }
}

module.exports = requireAuth;
