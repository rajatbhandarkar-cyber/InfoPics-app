const express = require("express");
const passport = require("passport");
const router = express.Router();
const { sendVerificationEmail } = require("../utils/sendVerificationEmail");

// Start Google OAuth
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account"
  })
);

// Google OAuth callback
router.get("/google/callback", (req, res, next) => {
  passport.authenticate("google", async (err, user, info) => {
    if (err) {
      console.error("❌ Google auth error:", err);
      req.flash("error", "Something went wrong with Google login.");
      return res.redirect("/login");
    }

    // Case A — existing user in DB: log them in and redirect to posts
    if (user) {
      return req.login(user, (loginErr) => {
        if (loginErr) {
          console.error("❌ Login error for existing Google user:", loginErr);
          req.flash("error", "Login failed. Please try again.");
          return res.redirect("/login");
        }
        req.session.save((saveErr) => {
          if (saveErr) console.error("❌ Session save error:", saveErr);
          return res.redirect("/posts");
        });
      });
    }

    // Case B — new Google user: create a tempUser in session and redirect to onboarding
    // info may contain tempUser from the strategy; prefer req.session.tempUser if present
    const authTemp = info?.tempUser;
    const sessionTemp = req.session?.tempUser;

    const sourceTemp = sessionTemp || authTemp;
    if (sourceTemp) {
      // Normalize a tempUser shape expected by your signup/onboarding flow
      const tempUser = {
        username:
          (sourceTemp.name || sourceTemp.email || "user")
            .toString()
            .replace(/\s+/g, "")
            .toLowerCase()
            .slice(0, 18) + Math.floor(Math.random() * 1000),
        email: sourceTemp.email,
        googleId: sourceTemp.googleId || sourceTemp.id || null,
        profilePic: sourceTemp.profilePic || sourceTemp.picture || "/images/default-avatar.png",
        verified: true, // trust Google email as verified; change if you still want code verification for Google users
        source: "google"
      };

      // Persist to session for the inline create-account or signup page to read
      req.session.tempUser = tempUser;

      // Optionally send a welcome email or verification (commented out)
      // try { await sendVerificationEmail(tempUser.email, someCode); } catch (e) { console.error(e); }

      // Ensure the session is saved before redirecting
      return req.session.save(() => {
        // Redirect to the inline create-account page or signup page where user chooses username (prefilled)
        // If you use a dedicated route like /create-account, change the URL below
        return res.redirect("/signup");
      });
    }

    // Fallback: nothing to log in or onboard
    console.error("❌ Google auth returned no user and no tempUser");
    req.flash("error", "Authentication failed.");
    return res.redirect("/login");
  })(req, res, next);
});

module.exports = router;
