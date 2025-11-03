const express = require("express");
const router = express.Router();
const User = require("../models/user.js");
const wrapAsync = require("../utils/wrapAsync");
const passport = require("passport");

const userController = require("../controllers/users.js");

/**
 * GET /signup
 * - Show a simple signup page (CTA to /auth/google).
 * - If req.session.tempUser exists (rare), pass it to the view.
 */
router
  .route("/signup")
  .get(userController.renderSignupForm)
  // For unified flow, POST /signup simply starts Google OAuth
  .post((req, res) => {
    // Start OAuth onboarding immediately
    return res.redirect("/auth/google");
  });

/**
 * Local login (username + password)
 * - Users authenticate using username (not email)
 */
router
  .route("/login")
  .get((req, res) => {
    const tempUser = req.session.tempUser || null;
    res.render("users/login", { tempUser });
  })
  .post(
    passport.authenticate("local", {
      failureFlash: true,
      failureRedirect: "/login",
    }),
    (req, res) => {
      req.flash("success", "Welcome back to InfoPics!");
      // ensure session persisted before redirect to avoid races
      req.session.save(() => {
        const redirectUrl = res.locals.redirectUrl || "/posts";
        res.redirect(redirectUrl);
      });
    }
  );

/**
 * Logout
 */
router.get("/logout", userController.logout);

/**
 * GET /create-account
 * - Renders the create-account page using req.session.tempUser (set after Google OAuth)
 */
router.get(
  "/create-account",
  wrapAsync(async (req, res) => {
    const tempUser = req.session.tempUser;
    if (!tempUser) {
      req.flash("error", "No signup in progress. Please sign in with Google to continue.");
      return res.redirect("/signup");
    }
    return res.render("users/createAccount", { tempUser });
  })
);

/**
 * POST /create-account
 * - Creates the real User using req.session.tempUser (googleId/email/profilePic)
 * - Enforces username uniqueness and password rules
 * - Logs the user in, clears session.tempUser, redirects to /posts
 */
router.post(
  "/create-account",
  wrapAsync(async (req, res, next) => {
    const { username, password } = req.body;
    const temp = req.session.tempUser;

    if (!temp) {
      req.flash("error", "Session expired or no Google profile found. Please sign in with Google again.");
      return res.redirect("/signup");
    }

    // Validate username
    if (!username || typeof username !== "string" || username.trim().length < 3) {
      req.flash("error", "Username must be at least 3 characters.");
      return res.redirect("/create-account");
    }
    const cleanUsername = username.trim();

    // Validate password
    if (!password || typeof password !== "string" || password.length < 6) {
      req.flash("error", "Password must be at least 6 characters.");
      return res.redirect("/create-account");
    }

    // Ensure username uniqueness
    const existing = await User.findOne({ username: cleanUsername });
    if (existing) {
      req.flash("error", "Username already taken. Please choose another.");
      return res.redirect("/create-account");
    }

    // Enforce email uniqueness (recommended): if an account already exists with this email, prompt to sign in
    const existingByEmail = await User.findOne({ email: temp.email.toLowerCase().trim() });
    if (existingByEmail) {
      req.flash("error", "An account with this email already exists. Try signing in instead.");
      return res.redirect("/login");
    }

    // Build user data from session.tempUser
    const userData = {
      username: cleanUsername,
      email: temp.email.toLowerCase().trim(),
      googleId: temp.googleId || null,
      profilePic: temp.profilePic || "/images/default-avatar.png",
      verified: true,
    };

    // Register the user using passport-local-mongoose (handles hashing)
    let newUser;
    try {
      newUser = await User.register(new User(userData), password);
      console.log("✅ New user created (unified Google-first):", newUser.username, newUser.email);
    } catch (regErr) {
      if (regErr && regErr.name === "UserExistsError") {
        req.flash("error", "Username already exists. Please choose another.");
        return res.redirect("/create-account");
      }
      throw regErr;
    }

    // Log the new user in, clear session.tempUser, and redirect
    req.login(newUser, (err) => {
      if (err) {
        console.error("❌ Login error after account creation:", err);
        req.flash("error", "Could not log you in. Try logging in manually.");
        return res.redirect("/login");
      }
      delete req.session.tempUser;
      req.session.save((saveErr) => {
        if (saveErr) console.error("❌ Session save error after creating account:", saveErr);
        req.flash("success", "Account created. Welcome to InfoPics!");
        return res.redirect("/posts");
      });
    });
  })
);

module.exports = router;
