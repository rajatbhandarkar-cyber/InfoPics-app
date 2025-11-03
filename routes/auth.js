const express = require("express");
const passport = require("passport");
const router = express.Router();

const normalizeTemp = (profile) => {
  if (!profile) return null;
  // profile may come from Passport's profile object or earlier temp shapes
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

    // Case B — new Google onboarding: prefer session.tempUser, then info.tempUser, then passport profile
    const authTemp = info?.tempUser;
    const sessionTemp = req.session?.tempUser;
    const profileFromPassport = req.user || info?.profile || info?.rawProfile || null;

    const source = sessionTemp || authTemp || profileFromPassport;

    if (!source) {
      console.error("❌ Google auth returned no user and no tempUser");
      req.flash("error", "Authentication failed. Try signing in with Google again.");
      return res.redirect("/signup");
    }

    // Normalize and store in session
    try {
      req.session.tempUser = normalizeTemp(source);

      // Cleanup any legacy flags
      delete req.session.attachGoogle;
      delete req.session.pendingSignup;

      console.log("AFTER GOOGLE CALLBACK tempUser (session):", req.session.tempUser);

      // Persist session then redirect to signup (page will render username/password form)
      return req.session.save((saveErr) => {
        if (saveErr) console.error("❌ Session save error after storing tempUser:", saveErr);
        return res.redirect("/signup");
      });
    } catch (e) {
      console.error("❌ Error handling Google callback onboarding:", e);
      req.flash("error", "Could not continue signup. Please try again.");
      return res.redirect("/signup");
    }
  })(req, res, next);
});

module.exports = router;
