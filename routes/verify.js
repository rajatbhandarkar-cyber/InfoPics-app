const express = require("express");
const router = express.Router();
const User = require("../models/user");
const { sendVerificationEmail } = require("../utils/sendVerificationEmail"); // helper that returns a Promise
const crypto = require("crypto");

/**
 * Helper - generate 6 digit code as string
 */
const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

/**
 * GET /verify
 * Render verify page if we have a tempUser in session
 */
router.get("/", (req, res) => {
  const temp = req.session.tempUser;
  const email = temp?.email;
  if (!email) {
    req.flash("error", "Please sign up first.");
    return res.redirect("/signup");
  }
  res.render("verify.ejs", { email });
});

/**
 * POST /verify/send
 * (re)send verification code to the tempUser.email
 */
router.post("/send", async (req, res) => {
  const temp = req.session.tempUser;
  const email = temp?.email;
  if (!email) {
    req.flash("error", "Email not found. Please sign up first.");
    return res.redirect("/signup");
  }

  const code = generateCode();
  // store both places: top-level key and in tempUser object for clarity
  req.session.verificationCode = code;
  req.session.tempUser.verificationCode = code;

  try {
    // prefer using your shared helper
    if (typeof sendVerificationEmail === "function") {
      await sendVerificationEmail(email, code);
    } else {
      // fallback: log code if helper not available
      console.log("📨 Verification code (no helper):", code);
    }
    console.log(`✅ Verification code sent to ${email}`);
    req.flash("success", "Verification code sent! Check your Gmail.");
    return req.session.save(() => res.redirect("/verify"));
  } catch (err) {
    console.error("❌ Email sending failed:", err);
    req.flash("error", "Failed to send verification email. Try again.");
    return res.redirect("/verify");
  }
});

/**
 * POST /verify/check
 * Verify the code and create/login the real user
 */
router.post("/check", async (req, res) => {
  const { code } = req.body;
  const sessionCode = req.session.verificationCode || req.session.tempUser?.verificationCode;
  const temp = req.session.tempUser;

  if (!temp || !temp.email || !sessionCode) {
    req.flash("error", "Session expired. Please sign up again.");
    return res.redirect("/signup");
  }

  if (String(code).trim() !== String(sessionCode).trim()) {
    req.flash("error", "Incorrect verification code.");
    return res.redirect("/verify");
  }

  try {
    // If user already exists, prefer updating verified flag and logging them in
    let user = await User.findOne({ email: temp.email });

    if (!user) {
      // Create the user in DB using passport-local-mongoose's register
      // For manual flow we have temp.password; for google flow create a random secure password
      const chosenPassword =
        temp.source === "manual" && temp.password && temp.password.length >= 6
          ? temp.password
          : crypto.randomBytes(12).toString("base64");

      const userData = {
        username: temp.username,
        email: temp.email,
        profilePic: temp.profilePic || "/images/default-avatar.png",
        googleId: temp.googleId || null,
        verified: true,
      };

      // User.register will hash and save correctly
      user = await User.register(new User(userData), chosenPassword);
      console.log("✅ New user created:", user.email);
    } else {
      // Existing user found: mark verified
      user.verified = true;
      await user.save();
      console.log("🔁 Existing user verified:", user.email);
    }

    // Log the user in and persist the session before redirecting
    req.login(user, (loginErr) => {
      if (loginErr) {
        console.error("❌ req.login error after verification:", loginErr);
        req.flash("error", "Login failed. Please try logging in.");
        return res.redirect("/login");
      }

      req.session.save((saveErr) => {
        if (saveErr) {
          console.error("❌ Session save error after verification:", saveErr);
          req.flash("error", "Session save failed. Please try logging in.");
          return res.redirect("/login");
        }

        // Clean up temp session data
        delete req.session.verificationCode;
        delete req.session.tempUser;

        req.flash("success", "Email verified! Welcome to InfoPics.");
        return res.redirect("/posts");
      });
    });
  } catch (err) {
    console.error("❌ Verification/process failed:", err);
    req.flash("error", "Verification failed. Please try again.");
    return res.redirect("/verify");
  }
});

module.exports = router;
