const express = require("express");
const router = express.Router();
const User = require("../models/user.js");
const PendingUser = require("../models/pendingUser");
const wrapAsync = require("../utils/wrapAsync");
const passport = require("passport");

const userController = require("../controllers/users.js");

/**
 * GET /signup
 * - If coming from Google flow, req.session.tempUser will prefill fields
 */
router
  .route("/signup")
  .get(userController.renderSignupForm)
  .post(wrapAsync(userController.signup));

/**
 * Local login
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
      // ensure session persisted before redirect to avoid races in some environments
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
 * Inline create-account page (GET)
 * - Used for Google-first flow: user chooses username (and optional password)
 * - If a pendingId exists, prefer data from PendingUser
 */
router.get("/create-account", wrapAsync(async (req, res) => {
  let tempUser = req.session.tempUser;
  if (req.session.pendingId) {
    const pending = await PendingUser.findById(req.session.pendingId).lean();
    if (pending) {
      tempUser = {
        username: pending.username,
        email: pending.email,
        profilePic: pending.profilePic,
        googleId: pending.googleId,
        source: pending.source,
      };
      // also keep a session preview
      req.session.tempUser = tempUser;
    }
  }

  if (!tempUser) {
    req.flash("error", "No signup in progress. Please sign in with Google or sign up.");
    return res.redirect("/login");
  }
  res.render("users/createAccount", { tempUser });
}));

/**
 * Inline create-account (POST)
 * - Handles both /create-account and /create-account-inline logic in one place
 * - Creates the real DB user via User.register, logs them in, clears session/pending
 */
router.post(
  "/create-account",
  wrapAsync(async (req, res, next) => {
    const { username, password } = req.body;

    // Prefer pending record if present
    let pending = null;
    if (req.session.pendingId) {
      pending = await PendingUser.findById(req.session.pendingId).lean();
    }

    const temp = pending || req.session.tempUser;
    if (!temp) {
      req.flash("error", "No signup in progress. Please sign in with Google or sign up.");
      return res.redirect("/login");
    }

    // Validate username
    if (!username || username.length < 3) {
      req.flash("error", "Username must be at least 3 characters.");
      return res.redirect("/create-account");
    }

    // Check uniqueness
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      req.flash("error", "Username already taken. Please choose another.");
      return res.redirect("/create-account");
    }

    // If an account already exists for this email, direct user to login
    const existingEmail = await User.findOne({ email: temp.email });
    if (existingEmail) {
      req.flash("info", "An account with this email already exists. Please log in.");
      return res.redirect("/login");
    }

    // Prepare user data (prefer pending values)
    const newUser = new User({
      username,
      email: temp.email,
      googleId: pending?.googleId || temp.googleId || null,
      profilePic: pending?.profilePic || temp.profilePic || "/images/default-avatar.png",
      verified: temp.verified === true,
    });

    // Choose password: provided or random strong one (Google users can skip)
    const chosenPassword =
      password && password.length >= 6 ? password : Math.random().toString(36).slice(2, 12);

    // Register user (passport-local-mongoose handles hashing and metadata)
    const registeredUser = await User.register(newUser, chosenPassword);

    // Remove pending record if present
    if (pending && pending._id) {
      try {
        await PendingUser.findByIdAndDelete(pending._id);
      } catch (e) {
        console.error("⚠️ Could not delete PendingUser after creating User:", e);
      }
    }

    // Login and persist session before redirect
    req.login(registeredUser, (err) => {
      if (err) return next(err);
      req.session.save((saveErr) => {
        if (saveErr) console.error("❌ Session save error:", saveErr);
        // Clear tempUser and pending pointer
        delete req.session.tempUser;
        delete req.session.pendingId;
        req.flash("success", "Account created. Welcome to InfoPics!");
        return res.redirect("/posts");
      });
    });
  })
);

module.exports = router;
