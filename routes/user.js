const express = require("express");
const router = express.Router();
const passport = require("passport");
const wrapAsync = require("../utils/wrapAsync");
const userController = require("../controllers/users.js");
const User = require("../models/user");


/**
 * GET /signup
 * - Render signup.ejs. That view will show the "Continue with Google" CTA when
 *   req.session.tempUser is absent, and the username/password form when present.
 */
router.get("/signup", (req, res) => {
  const tempUser = req.session.tempUser || null;
  // render the signup page (signup.ejs should handle both states)
  return res.render("users/signup", { tempUser });
});

/**
 * POST /signup
 * - For safety, starting a POST to /signup also begins Google OAuth
 */
router.post("/signup", (req, res) => {
  return res.redirect("/auth/google");
});

/**
 * POST /create-account
 * - The username/password form posts here.
 * - This delegates to controllers/users.createAccount which should:
 *    - read req.session.tempUser,
 *    - validate username/password,
 *    - register the new user,
 *    - req.login the user, delete req.session.tempUser, save session, redirect to /posts.
 *
 * If createAccount throws, wrapAsync will pass the error to your error handler.
 */
router.post("/create-account", wrapAsync(userController.createAccount));

/**
 * Local login (username + password)
 */
router.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) {
      console.error("❌ Passport error:", err);
      return next(err);
    }

    if (!user) {
      // Stay on login page and show inline errors
      return res.status(401).render("users/login", {
        tempUser: req.session.tempUser || null,
        error: {
          username: "Wrong username",
          password: "Wrong password",
        },
      });
    }

    req.logIn(user, (err) => {
      if (err) {
        console.error("❌ Login error:", err);
        return next(err);
      }

      req.flash("success", "Welcome back to InfoPics!");
      req.session.save(() => {
        const redirectUrl = res.locals.redirectUrl || "/posts";
        res.redirect(redirectUrl);
      });
    });
  })(req, res, next);
});


/**
 * Logout
 */
router.get("/logout", userController.logout);

/**
 * GET /create-account
 * - For legacy links: if tempUser present render signup (so user sees the form),
 *   otherwise redirect to /signup to start OAuth.
 */
router.get("/create-account", (req, res) => {
  if (req.session?.tempUser) {
    return res.render("users/signup", { tempUser: req.session.tempUser });
  }
  return res.redirect("/signup");
});

router.post("/admin/set-password", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(404).send("User not found");

  await user.setPassword(password);
  await user.save();
  res.send("✅ Password set successfully");
});


module.exports = router;
