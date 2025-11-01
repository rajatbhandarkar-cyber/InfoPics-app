const express = require("express");
const router = express.Router();
const User = require("../models/user");
const PendingUser = require("../models/pendingUser");
const { sendVerificationEmail } = require("../utils/sendVerificationEmail");
const crypto = require("crypto");

/**
 * Helper - generate 6 digit code as string
 */
const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

/**
 * GET /verify
 * Renders verify page. Prefers email from session.tempUser or from pending record referenced by session.pendingId.
 */
router.get("/", async (req, res) => {
  try {
    let email = req.session.tempUser?.email;
    // If we have a pendingId stored, fetch it to display the correct email
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
 * - If session has pendingId use it; otherwise fall back to session.tempUser.email
 * - Create or refresh a verification code on the PendingUser record (if present),
 *   or set a session code if we only have session.tempUser.
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
      // Update code on PendingUser so verification can be done by code
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
      // No pending record: store code in session.tempUser for backward compatibility
      req.session.verificationCode = code;
      req.session.tempUser = {
        ...(req.session.tempUser || {}),
        verificationCode: code,
        codeIssuedAt: Date.now(),
      };
    }

    try {
      await sendVerificationEmail(email, code);
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
 * - Accepts { code } from the form.
 * - Finds PendingUser by session.pendingId or by matching code.
 * - Creates the final User with googleId/profilePic preserved, deletes PendingUser, logs in the user.
 *
 * Note about passwords:
 * - If the pending record came from a manual signup where a password was provided at signup time,
 *   we attempt to use req.session.tempUser.password (if present) as the chosenPassword.
 * - If no usable plaintext password is available, we generate a strong random password for the created account.
 *   (You can adapt this to require the user to set their password during verification.)
 */
router.post("/check", async (req, res) => {
  const { code } = req.body;
  console.log("DEBUG verify/check — req.body:", req.body);
  try {
    // First try to locate a PendingUser by pendingId (preferred)
    let pending = null;
    if (req.session.pendingId) {
      pending = await PendingUser.findById(req.session.pendingId).lean();
    }

    // If not found yet, try to find by code (search recent pending records with that code)
    if (!pending) {
      pending = await PendingUser.findOne({ code }).sort({ createdAt: -1 }).lean();
    }

    // If still no pending, maybe the flow used session.tempUser with code in session
    const sessionCode = req.session.tempUser?.verificationCode || req.session.verificationCode;
    const temp = req.session.tempUser;

    // Validate presence of a verification source
    if (!pending && (!temp || !temp.email || !sessionCode)) {
      req.flash("error", "Session expired. Please sign up again.");
      return res.redirect("/signup");
    }

    // If pending was found, validate code matches (if code provided)
    if (pending) {
      if (!code || String(code).trim() !== String(pending.code).trim()) {
        req.flash("error", "Incorrect verification code.");
        return res.redirect("/verify");
      }
    } else {
      // No pending: validate session code
      if (!code || String(code).trim() !== String(sessionCode).trim()) {
        req.flash("error", "Incorrect verification code.");
        return res.redirect("/verify");
      }
    }

    // Determine canonical username to register and ensure uniqueness
    const usernameToUse = (pending?.username || temp?.username || "").trim();
    if (!usernameToUse || usernameToUse.length < 3) {
      req.flash("error", "Username missing or too short. Please provide a username.");
      return res.redirect("/signup");
    }

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

    // Register the final user
    const user = await User.register(new User(userData), chosenPassword);
    console.log("✅ New user created:", user.username, user.email);

    // Clean up pending record if it exists
    if (pending && pending._id) {
      try {
        await PendingUser.findByIdAndDelete(pending._id);
      } catch (delErr) {
        console.error("⚠️ Could not delete PendingUser:", delErr);
      }
    }

    // Log the newly created user in and persist session
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

        // Clean up temp session data and pending pointer
        delete req.session.verificationCode;
        delete req.session.tempUser;
        delete req.session.pendingId;

        req.flash("success", "Email verified! Welcome to InfoPics.");
        return res.redirect("/posts");
      });

      console.log("DEBUG session.passport after save:", req.session.passport);
    });
  } catch (err) {
    console.error("❌ Verification/process failed:", err);
    req.flash("error", "Verification failed. Please try again.");
    return res.redirect("/verify");
  }
});

module.exports = router;
