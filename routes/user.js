const express = require("express");
const router = express.Router();
const passport = require("passport");
const wrapAsync = require("../utils/wrapAsync");
const userController = require("../controllers/users.js");
const User = require("../models/user");

router.get("/signup", (req, res) => {
  const tempUser = req.session.tempUser || null;
  // render the signup page (signup.ejs should handle both states)
  return res.render("users/signup", { tempUser });
});


router.post("/signup", (req, res) => {
  return res.redirect("/auth/google");
});


router.post("/create-account", wrapAsync(userController.createAccount));

/**
 * Local login (username + password)
 */
router.post("/login", express.json(), (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          password: "Credentials do not match, please try again.",
        },
      });
    }

    req.logIn(user, (err) => {
      if (err) return next(err);

      req.session.save(() => {
        res.json({ success: true });
      });
    });
  })(req, res, next);
});



/**
 * Logout
 */
router.get("/logout", userController.logout);

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
