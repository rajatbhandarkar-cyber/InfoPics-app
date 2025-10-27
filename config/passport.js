const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const mongoose = require("mongoose");
const User = require("../models/user"); // adjust path if needed

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const existingUser = await User.findOne({ googleId: profile.id });

    if (existingUser) {
      console.log("✅ Existing Google user:", existingUser);
      return done(null, existingUser);
    }

    const newUser = new User({
      googleId: profile.id,
      username: profile.displayName,
      email: profile.emails[0].value,
      profilePic: profile.photos[0].value
    });

    await newUser.save();
    console.log("✅ New Google user created:", newUser);
    done(null, newUser);
  } catch (err) {
    console.log("❌ Error during Google OAuth:", err);
    done(err, null);
  }
}));

passport.serializeUser((user, done) => {
  console.log("🔐 Serializing user:", user);
  console.log("✅ Using _id:", user._id);
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  console.log("🔍 Deserializing user with ID:", id);
  if (!mongoose.Types.ObjectId.isValid(id)) {
    console.log("❌ Invalid ObjectId:", id);
    return done(null, false);
  }
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    console.log("❌ Error during deserialization:", err);
    done(err, null);
  }
});
