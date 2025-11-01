const express = require("express");
const passport = require("passport");
const router = express.Router();
const PendingUser = require("../models/pendingUser");
const { sendVerificationEmail } = require("../utils/sendVerificationEmail");

// Helper: generate 6-digit code as string
const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

/**
 * Start Google OAuth
 */
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  })
);

/**
 * Google OAuth callback
 * - If existing user by googleId: log in and redirect.
 * - Else: create PendingUser (with code), send code to email, stash pendingId & tempUser in session, redirect to /verify.
 */
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

    // Case B — new Google user: info may contain tempUser from strategy
    const authTemp = info?.tempUser;
    const sessionTemp = req.session?.tempUser;
    const sourceTemp = sessionTemp || authTemp;

    if (!sourceTemp) {
      console.error("❌ Google auth returned no user and no tempUser");
      req.flash("error", "Authentication failed.");
      return res.redirect("/login");
    }

    try {
      // Build normalized pending data
      const normalizedUsername =
        (sourceTemp.name || sourceTemp.email || "user")
          .toString()
          .replace(/\s+/g, "")
          .toLowerCase()
          .slice(0, 18) + Math.floor(Math.random() * 1000);

      const code = generateCode();

      const pendingPayload = {
        email: sourceTemp.email,
        username: normalizedUsername,
        googleId: sourceTemp.googleId || sourceTemp.id || null,
        profilePic: sourceTemp.profilePic || sourceTemp.picture || "/images/default-avatar.png",
        code,
        source: "google",
        meta: {
          // preserve any extra fields you want
          rawProfile: sourceTemp.rawProfile || null,
        },
      };

      // Create PendingUser in DB
      const pending = new PendingUser(pendingPayload);
      await pending.save();

      // Send the verification code
      try {
        await sendVerificationEmail(pending.email, code);
        console.log(`📨 Verification code sent to ${pending.email} (pendingId: ${pending._id})`);
      } catch (emailErr) {
        console.error("❌ Failed to send verification email for pending user:", emailErr);
        // proceed — user can request resend from /verify
      }

      // Persist a small session pointer to the pending record and tempUser preview
      req.session.pendingId = String(pending._id);
      req.session.tempUser = {
        username: pending.username,
        email: pending.email,
        profilePic: pending.profilePic,
        googleId: pending.googleId,
        source: "google",
        // do not store code in session — lookup by pendingId on verify
      };

      console.log("AFTER GOOGLE CALLBACK tempUser (session):", JSON.stringify(req.session.tempUser));
      console.log("AFTER GOOGLE CALLBACK pendingId:", req.session.pendingId);

      // Ensure session saved before redirecting
      return req.session.save((saveErr) => {
        if (saveErr) console.error("❌ Session save error after creating pending:", saveErr);
        return res.redirect("/verify");
      });
    } catch (e) {
      console.error("❌ Error creating PendingUser after Google OAuth:", e);
      req.flash("error", "Could not continue signup. Please try again.");
      return res.redirect("/login");
    }
  })(req, res, next);
});

module.exports = router;
