const User = require("../models/user");

/**
 * Helpers
 */
const normalizeTemp = (temp) => {
  if (!temp) return null;
  return {
    googleId: temp.googleId || temp.id || null,
    email: (temp.email || "").toLowerCase().trim(),
    profilePic: temp.profilePic || temp.imageUrl || temp.picture || "/images/default-avatar.png",
    name: temp.name || temp.displayName || "",
    source: temp.source || "google",
    verified: temp.verified === true,
  };
};

/**
 * Render signup page
 * - Show CTA when no tempUser, show username/password form when tempUser exists
 */
module.exports.renderSignupForm = (req, res) => {
  const tempUser = normalizeTemp(req.session?.tempUser) || null;
  return res.render("users/signup", { tempUser });
};

/**
 * Create-account page (GET)
 * - If tempUser exists, render the same signup view so the user sees the username/password form.
 * - Otherwise redirect to /signup to begin the Google flow.
 */
module.exports.renderCreateAccount = (req, res) => {
  const tempUser = normalizeTemp(req.session?.tempUser);
  if (!tempUser) {
    req.flash("info", "Please sign in with Google to continue.");
    return res.redirect("/signup");
  }
  return res.render("users/signup", { tempUser });
};

module.exports.createAccount = async (req, res, next) => {
  try {
    const tempRaw = req.session?.tempUser;
    const temp = normalizeTemp(tempRaw);
    if (!temp) {
      req.flash("error", "Session expired or no Google profile found. Please sign in with Google again.");
      return res.redirect("/signup");
    }

    const { username, password } = req.body;

    // username validation
    if (!username || typeof username !== "string" || username.trim().length < 3) {
      req.flash("error", "Username must be at least 3 characters.");
      return res.redirect("/signup");
    }
    const cleanUsername = username.trim();

    // password validation
    if (!password || typeof password !== "string" || password.length < 6) {
      req.flash("error", "Password must be at least 6 characters.");
      return res.redirect("/signup");
    }

    // unique username
    const existingUser = await User.findOne({ username: cleanUsername });
    if (existingUser) {
      req.flash("error", "Username already taken. Please choose another.");
      return res.redirect("/signup");
    }

    // optional: prevent duplicate emails
    const existingByEmail = await User.findOne({ email: temp.email });
    if (existingByEmail) {
      req.flash("error", "An account with this email already exists. Try signing in instead.");
      return res.redirect("/login");
    }

    // build user payload
    const userData = {
      username: cleanUsername,
      email: temp.email,
      googleId: temp.googleId || null,
      profilePic: temp.profilePic || "/images/default-avatar.png",
      verified: true,
    };

    // register user (passport-local-mongoose)
    let newUser;
    try {
      newUser = await User.register(new User(userData), password);
      console.log("✅ New user created:", newUser.username, newUser.email);
    } catch (regErr) {
      if (regErr && regErr.name === "UserExistsError") {
        req.flash("error", "Username already exists. Please choose another.");
        return res.redirect("/signup");
      }
      throw regErr;
    }

    // login the new user, clear tempUser and persist session
    req.login(newUser, (err) => {
      if (err) {
        console.error("❌ Login error after account creation:", err);
        req.flash("error", "Could not log you in automatically. Please sign in.");
        return res.redirect("/login");
      }
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
    return res.redirect("/signup");
  }
};

/**
 * Local login handler (used after passport-local authentication)
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

module.exports.normalizeTemp = normalizeTemp;
