const express = require("express");
const passport = require("passport");
const router = express.Router();

// Start Google OAuth (unified flow: OAuth first)
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  })
);

// Google OAuth callback
router.get("/google/callback", (req, res, next) => {
  passport.authenticate("google", async (err, user, info) => {
    if (err) {
      console.error("❌ Google auth error:", err);
      req.flash("error", "Something went wrong with Google login.");
      return res.redirect("/signup");
    }

    // Case A — existing user found by googleId: log them in and redirect to posts
    if (user) {
      return req.login(user, (loginErr) => {
        if (loginErr) {
          console.error("❌ Login error for existing Google user:", loginErr);
          req.flash("error", "Login failed. Please try again.");
          return res.redirect("/login");
        }
        return req.session.save((saveErr) => {
          if (saveErr) console.error("❌ Session save error:", saveErr);
          return res.redirect("/posts");
        });
      });
    }

    // Case B — new Google onboarding: strategy should provide tempUser (info.tempUser) and/or session.tempUser
    const authTemp = info?.tempUser;
    const sessionTemp = req.session?.tempUser;
    const sourceTemp = sessionTemp || authTemp;

    if (!sourceTemp) {
      console.error("❌ Google auth returned no user and no tempUser");
      req.flash("error", "Authentication failed. Try signing in with Google again.");
      return res.redirect("/signup");
    }

    // Ensure session.tempUser is populated so /create-account can render the preview
    try {
      req.session.tempUser = {
        googleId: sourceTemp.googleId || sourceTemp.id || null,
        email: (sourceTemp.email || "").toLowerCase().trim(),
        profilePic: sourceTemp.profilePic || sourceTemp.picture || "/images/default-avatar.png",
        name: sourceTemp.name || "",
        source: "google",
        verified: true,
      };

      // Clear any attach flags if present
      if (req.session.attachGoogle) delete req.session.attachGoogle;
      if (req.session.pendingSignup) delete req.session.pendingSignup;

      console.log("AFTER GOOGLE CALLBACK tempUser (session):", JSON.stringify(req.session.tempUser));

      // Persist session then redirect to create-account where user picks username/password
      return req.session.save((saveErr) => {
        if (saveErr) console.error("❌ Session save error after storing tempUser:", saveErr);
        return res.redirect("/create-account");
      });
    } catch (e) {
      console.error("❌ Error handling Google callback onboarding:", e);
      req.flash("error", "Could not continue signup. Please try again.");
      return res.redirect("/signup");
    }
  })(req, res, next);
});

module.exports = router;
