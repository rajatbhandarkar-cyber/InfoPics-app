const express = require("express");
const router = express.Router();
const User = require("../models/user");
const PendingUser = require("../models/pendingUser");
const crypto = require("crypto");

/**
 * Helper - generate 6 digit code as string
 */
const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

/**
 * GET /verify
 */
router.get("/", async (req, res) => {
  try {
    let email = req.session.tempUser?.email;
    if (req.session.pendingId) {
      const pending = await PendingUser.findById(req.session.pendingId).lean();
      if (pending?.email) email = pending.email;
    }
    if (!email) {
      req.flash("error", "Please sign up first.");
      return res.redirect("/signup");
    }
    return res.render("users/verify", { email });
  } catch (err) {
    console.error("❌ GET /verify error:", err);
    req.flash("error", "Something went wrong. Please try again.");
    return res.redirect("/signup");
  }
});

/**
 * POST /verify/send
 */
router.post("/send", async (req, res) => {
  try {
    const sessionTemp = req.session.tempUser;
    const pendingId = req.session.pendingId;
    const email = sessionTemp?.email;

    if (!email && !pendingId) {
      req.flash("error", "Email not found. Please sign up first.");
      return res.redirect("/signup");
    }

    const code = generateCode();

    if (pendingId) {
      const pending = await PendingUser.findByIdAndUpdate(
        pendingId,
        { code, updatedAt: new Date() },
        { new: true }
      );
      if (!pending) {
        req.flash("error", "Could not find verification record. Please sign up again.");
        return res.redirect("/signup");
      }
    } else {
      req.session.verificationCode = code;
      req.session.tempUser = {
        ...(req.session.tempUser || {}),
        verificationCode: code,
        codeIssuedAt: Date.now(),
      };
    }

    try {
      const { sendVerificationEmail } = require("../utils/sendVerificationEmail");
      await sendVerificationEmail(email, code, {
        pendingId: req.session.pendingId,
        appBaseUrl: process.env.APP_BASE_URL,
      });
      console.log(`✅ Verification code sent to ${email}`);
      req.flash("success", "Verification code sent! Check your Gmail.");
      return req.session.save(() => res.redirect("/verify"));
    } catch (err) {
      console.error("❌ Email sending failed:", err);
      req.flash("error", "Failed to send verification email. Try again.");
      return res.redirect("/verify");
    }
  } catch (err) {
    console.error("❌ POST /verify/send error:", err);
    req.flash("error", "Failed to send verification code. Please try again.");
    return res.redirect("/verify");
  }
});

/**
 * POST /verify/check
 */
router.post("/check", async (req, res) => {
  const { code } = req.body;
  const formPendingId = req.body.pendingId || null;
  console.log("DEBUG verify/check — req.body:", req.body);

  try {
    // Resolve pending by form pendingId -> session.pendingId -> code search
    let pending = null;
    const pendingIdToUse = formPendingId || req.session.pendingId || null;
    if (pendingIdToUse) pending = await PendingUser.findById(pendingIdToUse).lean();
    if (!pending && code) pending = await PendingUser.findOne({ code }).sort({ createdAt: -1 }).lean();

    const sessionCode = req.session.tempUser?.verificationCode || req.session.verificationCode;
    const temp = req.session.tempUser;

    if (!pending && (!temp || !temp.email || !sessionCode)) {
      req.flash("error", "Session expired. Please sign up again.");
      return res.redirect("/signup");
    }

    // Validate the verification code
    if (pending) {
      if (!code || String(code).trim() !== String(pending.code).trim()) {
        req.flash("error", "Incorrect verification code.");
        return res.redirect("/verify");
      }
    } else {
      if (!code || String(code).trim() !== String(sessionCode).trim()) {
        req.flash("error", "Incorrect verification code.");
        return res.redirect("/verify");
      }
    }

    // If this pending record came from a Google-first flow, redirect to /create-account
    // so user can choose a username (preserve pending pointer & temp preview)
    if (pending && pending.source === "google") {
      console.log("INFO verify/check — google-origin pending; redirecting to create-account:", pending._id);
      req.session.pendingId = String(pending._id);
      req.session.tempUser = {
        username: pending.username || "",
        email: pending.email,
        profilePic: pending.profilePic,
        googleId: pending.googleId,
        source: "google",
        verified: true,
      };
      return req.session.save(() => res.redirect("/create-account"));
    }

    // Determine canonical username to register (manual signup path)
    const usernameToUse = (pending?.username || temp?.username || "").trim();
    if (!usernameToUse || usernameToUse.length < 3) {
      req.flash("error", "Username missing or too short. Please provide a username.");
      return res.redirect("/signup");
    }

    // Only username must be unique; allow duplicate emails
    const existingUser = await User.findOne({ username: usernameToUse });
    if (existingUser) {
      req.flash("error", "Username already taken. Please choose another username.");
      return res.redirect("/signup");
    }

    // Build userData using pending record if available, otherwise fall back to session.tempUser
    const userData = {
      username: usernameToUse,
      email: (pending?.email || temp?.email).toLowerCase().trim(),
      profilePic: pending?.profilePic || temp?.profilePic || "/images/default-avatar.png",
      googleId: pending?.googleId || temp?.googleId || null,
      verified: true,
    };

    console.log("WILL REGISTER userData:", JSON.stringify(userData));

    // Choose password: prefer plaintext in session.tempUser if present; otherwise generate one
    const chosenPassword =
      (temp && temp.password && temp.password.length >= 6) ? temp.password : crypto.randomBytes(12).toString("base64");

    // Attempt registration with safe error handling
    let user;
    try {
      user = await User.register(new User(userData), chosenPassword);
      console.log("✅ New user created:", user.username, user.email);
    } catch (regErr) {
      if (regErr && regErr.name === "UserExistsError") {
        console.warn("⚠️ Registration failed — conflict:", regErr);
        req.flash("error", "An account with that username already exists. Please choose a different username.");
        return res.redirect("/signup");
      }
      throw regErr;
    }

    // Delete pending document if present
    if (pending && pending._id) {
      try {
        await PendingUser.findByIdAndDelete(pending._id);
      } catch (delErr) {
        console.error("⚠️ Could not delete PendingUser:", delErr);
      }
    }

    // Log in and persist session
    req.login(user, (loginErr) => {
      console.log("DEBUG req.login callback — loginErr:", loginErr);
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

        delete req.session.verificationCode;
        delete req.session.tempUser;
        delete req.session.pendingId;

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
