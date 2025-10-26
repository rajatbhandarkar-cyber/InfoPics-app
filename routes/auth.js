const express = require("express");
const passport = require("passport");
const router = express.Router();

router.get("/google", passport.authenticate("google", {
  scope: ["profile", "email"]
}));

router.get("/google/callback", passport.authenticate("google", {
  failureRedirect: "/login"
}), (req, res) => {
  res.redirect("/posts"); // or wherever you want
});

module.exports = router;
