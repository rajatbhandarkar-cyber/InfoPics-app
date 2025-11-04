const express = require("express");
const passport = require("passport");
const router = express.Router();

const normalizeTemp = (profile) => {
  if (!profile) return null;
  return {
    googleId: profile.googleId || profile.id || null,
    email: (profile.email || profile.emails?.[0]?.value || profile._json?.email || "").toLowerCase().trim(),
    profilePic:
      profile.profilePic ||
      profile.picture ||
      profile.photos?.[0]?.value ||
      profile._json?.picture ||
      "/images/default-avatar.png",
    name: profile.name || profile.displayName || (profile._json && profile._json.name) || "",
    source: "google",
    verified: true,
  };
};

// Start Google OAuth (unified flow)
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

    // If Passport returned a User object, log them in and create a session
    if (user) {
      return req.login(user, (loginErr) => {
        if (loginErr) {
          console.error("❌ Login error for Google user:", loginErr);
          req.flash("error", "Login failed. Please try again.");
          return res.redirect("/login");
        }
        // Persist session then redirect
        return req.session.save((saveErr) => {
          if (saveErr) console.error("❌ Session save error after login:", saveErr);
          console.log("✅ Google login successful for user:", user.username || user.email);
          return res.redirect("/posts");
        });
      });
    }

    // If no user was returned by Passport, try to extract profile/temp info for onboarding
    // Prefer existing session.tempUser, then info.tempUser, then info.profile or req.user shapes
    const sessionTemp = req.session?.tempUser || null;
    const infoTemp = info?.tempUser || null;
    const passportProfile = info?.profile || info?.rawProfile || req.user || null;

    const source = sessionTemp || infoTemp || passportProfile;

    if (!source) {
      console.error("❌ Google auth returned no user and no profile/tempUser");
      req.flash("error", "Authentication failed. Try signing in with Google again.");
      return res.redirect("/signup");
    }

    // Normalize and store in session, then redirect to onboarding
    try {
      req.session.tempUser = normalizeTemp(source);

      // cleanup legacy flags
      delete req.session.attachGoogle;
      delete req.session.pendingSignup;

      if (typeof req.session.save === "function") {
        await new Promise((resolve, reject) =>
          req.session.save((err) => (err ? reject(err) : resolve()))
        );
      }

      console.log("➡️ Stored tempUser in session for onboarding:", req.session.tempUser.email);
      return res.redirect("/signup");
    } catch (e) {
      console.error("❌ Error handling Google callback onboarding:", e);
      req.flash("error", "Could not continue signup. Please try again.");
      return res.redirect("/signup");
    }
  })(req, res, next);
});

module.exports = router;
