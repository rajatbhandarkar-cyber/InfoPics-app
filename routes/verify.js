const express = require("express");
const router = express.Router();
const User = require("../models/user");

// GET: Show verification form
router.get("/", (req, res) => {
  res.render("users/verify.ejs");
});

// POST: Handle code submission
router.post("/", async (req, res) => {
  const { code } = req.body;
  const userId = req.user?._id;

  if (!userId) {
    req.flash("error", "You must be logged in to verify your email.");
    return res.redirect("/login");
  }

  const user = await User.findById(userId);

  if (user.verificationCode === code) {
    user.verified = true;
    user.verificationCode = undefined; // Optional: clear the code
    await user.save();
    req.flash("success", "Your email has been verified!");
    res.redirect("/posts");
  } else {
    req.flash("error", "Invalid verification code. Please try again.");
    res.redirect("/verify");
  }
});

module.exports = router;
