const User = require("../models/user");
const PendingUser = require("../models/pendingUser");
const { sendVerificationEmail } = require("../utils/sendVerificationEmail");
const crypto = require("crypto");

// Helper - generate 6 digit code as string
const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

/**
 * Render signup page.
 * If a tempUser is present in session (Google flow or previously started manual flow),
 * pass it to the view so fields can be prefilled.
 */
module.exports.renderSignupForm = (req, res) => {
  const tempUser = req.session.tempUser || null;
  res.render("users/signup.ejs", { tempUser });
};

/**
 * Manual signup step 1:
 * - validate input
 * - create a PendingUser with verification code
 * - send verification email
 * - persist pendingId and a small tempUser preview in session
 * - redirect to /verify
 *
 * The real User record is created only after verification (looked up by PendingUser.code or pendingId).
 */
module.exports.signup = async (req, res, next) => {
  try {
    console.log("📥 Signup body:", req.body);
    const { newUsername, newEmail, newPassword } = req.body;

    if (!newUsername || !newEmail || !newPassword) {
      req.flash("error", "All fields are required.");
      return res.redirect("/signup");
    }

    if (!newEmail.endsWith("@gmail.com")) {
      console.log("❌ Invalid Gmail:", newEmail);
      req.flash("error", "Please use a valid Gmail address.");
      return res.redirect("/signup");
    }

    const cleanUsername = newUsername.trim();
    if (cleanUsername.length < 3 || newPassword.length < 6) {
      req.flash("error", "Username must be at least 3 characters and password at least 6.");
      return res.redirect("/signup");
    }

    const existingUsername = await User.findOne({ username: cleanUsername });
    if (existingUsername) {
      console.log("❌ Duplicate username:", cleanUsername);
      req.flash("error", "Username already taken. Please choose another.");
      return res.redirect("/signup");
    }

    // Generate verification code
    const verificationCode = generateCode();

    // Preserve any google data already in session.tempUser (set by OAuth)
    const sessionTemp = req.session.tempUser || {};

    // Build PendingUser payload: include google fields if present, else keep placeholders
    const pendingPayload = {
      email: newEmail.toLowerCase().trim(),
      username: cleanUsername,
      // NEVER store raw plaintext passwords in DB; here we keep a placeholder token for manual flows.
      // Actual password will be set when creating the real User using User.register.
      passwordHash: crypto.createHash("sha256").update(newPassword).digest("hex"),
      googleId: sessionTemp.googleId || null,
      profilePic: sessionTemp.profilePic || "/images/default-avatar.png",
      code: verificationCode,
      source: sessionTemp.source === "google" ? "google" : "manual",
      meta: {
        createdFrom: "manual-signup",
      },
    };

    // Create or overwrite any existing pending record for the same email (simpler UX)
    // You may prefer to keep multiple pending records; this approach keeps one pending per email.
    let pending = await PendingUser.findOneAndUpdate(
      { email: pendingPayload.email },
      pendingPayload,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Persist a small session pointer to the pending record and a preview tempUser
    req.session.pendingId = String(pending._id);
    req.session.tempUser = {
      username: pending.username,
      email: pending.email,
      profilePic: pending.profilePic,
      googleId: pending.googleId,
      source: pending.source,
    };

    console.log("AFTER SIGNUP tempUser (session):", JSON.stringify(req.session.tempUser));
    console.log("AFTER SIGNUP pendingId:", req.session.pendingId);

    // Send verification email (best effort)
    try {
      await sendVerificationEmail(pending.email, verificationCode);
      console.log("📨 Verification email sent to:", pending.email);
    } catch (emailErr) {
      console.error("❌ sendVerificationEmail error:", emailErr);
    }

    req.flash("success", "Verification code sent to your Gmail.");
    return req.session.save(() => res.redirect("/verify"));
  } catch (e) {
    console.error("❌ Signup error:", e);
    req.flash("error", e.message || "Signup failed.");
    return res.redirect("/signup");
  }
};

/**
 * Complete signup after Google-first inline flow.
 * This helper still creates the real User if session.pendingId/tempUser exist (created by auth.js).
 * If you prefer to centralize creation in /verify (recommended), you can retire this function.
 */
module.exports.completeGoogleSignup = async (req, res, next) => {
  try {
    // Prefer pending pointer if available
    const pendingId = req.session.pendingId;
    let pending = null;
    if (pendingId) pending = await PendingUser.findById(pendingId);

    // Fallback to session.tempUser (less reliable if user switched devices)
    const temp = pending || req.session.tempUser;
    if (!temp || temp.source !== "google") {
      req.flash("error", "No Google signup in progress. Please sign in with Google first.");
      return res.redirect("/login");
    }

    const { username, password } = req.body;
    if (!username || username.length < 3) {
      req.flash("error", "Username must be at least 3 characters.");
      return res.redirect("/signup");
    }

    // Ensure username is unique
    const existing = await User.findOne({ username });
    if (existing) {
      req.flash("error", "Username already taken. Choose another.");
      return res.redirect("/signup");
    }

    // Build userData from pending (prefer DB pending values)
    const userData = {
      username,
      email: pending?.email || temp.email,
      profilePic: pending?.profilePic || temp.profilePic || "/images/default-avatar.png",
      googleId: pending?.googleId || temp.googleId || null,
      verified: true,
    };

    const chosenPassword = password && password.length >= 6 ? password : Math.random().toString(36).slice(2, 12);
    const newUser = await User.register(new User(userData), chosenPassword);

    // Remove pending record if present
    if (pending) {
      try {
        await PendingUser.findByIdAndDelete(pending._id);
      } catch (e) {
        console.error("⚠️ Could not delete PendingUser after creating User:", e);
      }
    }

    // Log in and save session
    req.login(newUser, (err) => {
      console.log("DEBUG req.login callback — loginErr:", err);
      if (err) {
        console.error("❌ Login error after Google signup:", err);
        req.flash("error", "Login failed. Please try logging in.");
        return res.redirect("/login");
      }
      req.session.save((saveErr) => {
        if (saveErr) console.error("❌ Session save error:", saveErr);
        delete req.session.tempUser;
        delete req.session.pendingId;
        req.flash("success", "Account created. Welcome to InfoPics!");
        return res.redirect("/posts");
      });
    });
  } catch (err) {
    console.error("❌ completeGoogleSignup error:", err);
    req.flash("error", err.message || "Could not complete signup.");
    return res.redirect("/signup");
  }
};

/**
 * Local login (passport-local handled via route middleware)
 */
module.exports.login = async (req, res) => {
  req.flash("success", "Welcome back to InfoPics!");
  const redirectUrl = res.locals.redirectUrl || "/posts";
  return res.redirect(redirectUrl);
};

/**
 * Logout
 */
module.exports.logout = (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.flash("success", "You are logged out!");
    return res.redirect("/posts");
  });
};
