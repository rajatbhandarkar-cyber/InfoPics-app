const User = require("../models/user");
const { sendVerificationEmail } = require("../utils/sendVerificationEmail");
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
 * - create req.session.tempUser with verificationCode
 * - send verification email
 * - redirect to /verify
 *
 * Do NOT create the DB user here. Creation happens after verification.
 */
module.exports.signup = async (req, res, next) => {
  try {
    console.log("📥 Signup body:", req.body);
    const { newUsername, newEmail, newPassword } = req.body;

    // Basic input presence
    if (!newUsername || !newEmail || !newPassword) {
      req.flash("error", "All fields are required.");
      return res.redirect("/signup");
    }

    // Gmail check
    if (!newEmail.endsWith("@gmail.com")) {
      console.log("❌ Invalid Gmail:", newEmail);
      req.flash("error", "Please use a valid Gmail address.");
      return res.redirect("/signup");
    }

    // Username uniqueness
    const existingUsername = await User.findOne({ username: newUsername });
    if (existingUsername) {
      console.log("❌ Duplicate username:", newUsername);
      req.flash("error", "Username already taken. Please choose another.");
      return res.redirect("/signup");
    }

    // Strength check
    if (newUsername.length < 3 || newPassword.length < 6) {
      req.flash("error", "Username must be at least 3 characters and password at least 6.");
      return res.redirect("/signup");
    }

    // Create tempUser in session (manual flow)
    const verificationCode = generateCode();
    req.session.tempUser = {
      username: newUsername,
      email: newEmail,
      password: newPassword,
      googleId: null,
      profilePic: "/images/default-avatar.png",
      verified: false,
      verificationCode,
      source: "manual",
    };

    // Send verification email (helper returns a promise)
    try {
      await sendVerificationEmail(newEmail, verificationCode);
      console.log("📨 Verification email sent to:", newEmail);
    } catch (emailErr) {
      console.error("❌ sendVerificationEmail error:", emailErr);
      // still proceed to /verify so user can ask to resend
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
 * Inline create-account for Google-first users.
 * This route handles the form submitted after a successful Google OAuth when
 * we have req.session.tempUser populated with google info.
 *
 * Expected body: { username, password? }.
 * If password isn't provided we generate a strong random password.
 * We create the real DB user with User.register (passport-local-mongoose),
 * then req.login and req.session.save before redirecting to /posts.
 */
module.exports.completeGoogleSignup = async (req, res, next) => {
  try {
    const temp = req.session.tempUser;
    if (!temp || temp.source !== "google") {
      req.flash("error", "No Google signup in progress. Please sign in with Google first.");
      return res.redirect("/login");
    }

    const { username, password } = req.body;
    if (!username || username.length < 3) {
      req.flash("error", "Username must be at least 3 characters.");
      return res.redirect("/signup"); // or to the inline create-account page if different
    }

    // Ensure username is unique
    const existing = await User.findOne({ username });
    if (existing) {
      req.flash("error", "Username already taken. Choose another.");
      return res.redirect("/signup");
    }

    // Prepare DB user object
    const userData = {
      username,
      email: temp.email,
      googleId: temp.googleId || null,
      profilePic: temp.profilePic || "/images/default-avatar.png",
      verified: true
    };

    // Use User.register so passport-local-mongoose handles hashing and metadata
    const chosenPassword = password && password.length >= 6 ? password : Math.random().toString(36).slice(2, 12);
    const newUser = await User.register(new User(userData), chosenPassword);

    // Log the user in and persist session before redirect
    req.login(newUser, (err) => {
      if (err) {
        console.error("❌ Login error after Google signup:", err);
        req.flash("error", "Login failed. Please try logging in.");
        return res.redirect("/login");
      }
      req.session.save((saveErr) => {
        if (saveErr) console.error("❌ Session save error:", saveErr);
        // Clear tempUser from session
        delete req.session.tempUser;
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
