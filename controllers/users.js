const User = require("../models/user");
const sendVerificationEmail = require("../utils/sendVerificationEmail");

module.exports.renderSignupForm = (req, res) => {
  res.render("users/signup.ejs");
};

module.exports.signup = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    // ✅ Enforce Gmail-only signup
    if (!email.endsWith("@gmail.com")) {
      req.flash("error", "Please use a valid Gmail address.");
      return res.redirect("/signup");
    }

    // ✅ Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // ✅ Create and register user with verification code
    const newUser = new User({ username, email, verificationCode });
    const registeredUser = await User.register(newUser, password);

    // ✅ Send verification email
    await sendVerificationEmail(email, verificationCode);

    // ✅ Log the user in
    req.login(registeredUser, (err) => {
      if (err) return next(err);
      req.flash("success", "Signup successful! Check your Gmail for a verification code.");
      res.redirect("/verify");
    });

  } catch (e) {
    req.flash("error", e.message);
    res.redirect("/signup");
  }
};

module.exports.renderLoginForm = (req, res) => {
  res.render("users/login.ejs");
};

module.exports.login = async (req, res) => {
  req.flash("success", "Welcome back to InfoPics!");
  let redirectUrl = res.locals.redirectUrl || "/posts";
  res.redirect(redirectUrl);
};

module.exports.logout = (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.flash("success", "You are logged out!");
    res.redirect("/posts");
  });
};
