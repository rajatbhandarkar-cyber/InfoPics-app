const User = require("../models/user");
const crypto = require("crypto");

/**
 * Helpers
 */
const normalizeTemp = (temp) => {
  if (!temp) return null;
  return {
    googleId: temp.googleId || temp.id || null,
    email: (temp.email || "").toLowerCase().trim(),
    profilePic: temp.profilePic || temp.imageUrl || (temp.picture || "/images/default-avatar.png"),
    name: temp.name || temp.displayName || "",
    source: temp.source || "google",
    verified: temp.verified === true,
  };
};

/**
 * Render signup page
 * (Unified flow: user starts with Continue with Google which sets req.session.tempUser)
 */
module.exports.renderSignupForm = (req, res) => {
  const tempUser = normalizeTemp(req.session.tempUser) || null;
  res.render("users/signup.ejs", { tempUser });
};

/**
 * Create-account page (GET)
 * - Requires req.session.tempUser to be present (user arrived here after Google OAuth)
 * - Shows preview (email + profilePic) and asks for username + password
 */
module.exports.renderCreateAccount = (req, res) => {
  const tempUser = normalizeTemp(req.session.tempUser);
  if (!tempUser) {
    req.flash("error", "Please sign in with Google to continue.");
    return res.redirect("/signup");
  }
  return res.render("users/createAccount.ejs", { tempUser });
};

/**
 * Create-account (POST)
 * - Validates username/password
 * - Ensures username is unique and (optionally) email is unique
 * - Registers the User using passport-local-mongoose, including googleId/profilePic from session.tempUser
 * - Logs the user in, clears session.tempUser, redirects to /posts
 */
module.exports.createAccount = async (req, res, next) => {
  try {
    const tempRaw = req.session.tempUser;
    const temp = normalizeTemp(tempRaw);
    if (!temp) {
      req.flash("error", "Session expired or no Google profile found. Please sign in with Google again.");
      return res.redirect("/signup");
    }

    const { username, password } = req.body;

    // Validate username
    if (!username || typeof username !== "string" || username.trim().length < 3) {
      req.flash("error", "Username must be at least 3 characters.");
      return res.redirect("/create-account");
    }
    const cleanUsername = username.trim();

    // Validate password
    if (!password || typeof password !== "string" || password.length < 6) {
      req.flash("error", "Password must be at least 6 characters.");
      return res.redirect("/create-account");
    }

    // Ensure username uniqueness
    const existingUser = await User.findOne({ username: cleanUsername });
    if (existingUser) {
      req.flash("error", "Username already taken. Please choose another.");
      return res.redirect("/create-account");
    }

    // Optional: enforce email uniqueness (recommended). If you prefer allowing duplicates, remove this block.
    const existingByEmail = await User.findOne({ email: temp.email });
    if (existingByEmail) {
      req.flash("error", "An account with this email already exists. Try signing in instead.");
      return res.redirect("/login");
    }

    // Build user data from session.tempUser
    const userData = {
      username: cleanUsername,
      email: temp.email,
      googleId: temp.googleId || null,
      profilePic: temp.profilePic || "/images/default-avatar.png",
      verified: true,
    };

    // Register user (passport-local-mongoose handles hashing and saving)
    let newUser;
    try {
      newUser = await User.register(new User(userData), password);
      console.log("✅ New user created (Google-first):", newUser.username, newUser.email);
    } catch (regErr) {
      if (regErr && regErr.name === "UserExistsError") {
        req.flash("error", "Username already exists. Please choose another.");
        return res.redirect("/create-account");
      }
      throw regErr;
    }

    // Log the new user in, clear session.tempUser, save session, redirect
    req.login(newUser, (err) => {
      if (err) {
        console.error("❌ Login error after account creation:", err);
        req.flash("error", "Could not log you in. Try logging in manually.");
        return res.redirect("/login");
      }
      // Clear tempUser and persist session
      delete req.session.tempUser;
      req.session.save((saveErr) => {
        if (saveErr) console.error("❌ Session save error after creating account:", saveErr);
        req.flash("success", "Account created. Welcome to InfoPics!");
        return res.redirect("/posts");
      });
    });
  } catch (err) {
    console.error("❌ createAccount error:", err);
    req.flash("error", err.message || "Could not create account. Try again.");
    return res.redirect("/create-account");
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
