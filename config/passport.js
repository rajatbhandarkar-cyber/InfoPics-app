const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/user");

// Use passport-local-mongoose provided strategies/serializers
// (requires passportLocalMongoose plugin applied on the User schema)
passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Google OAuth strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
  passReqToCallback: true
}, async (req, accessToken, refreshToken, profile, done) => {
  try {
    const email = profile?.emails?.[0]?.value || profile._json?.email;
    if (!email) {
      console.log("❌ Google profile has no email:", profile);
      return done(new Error("No email in Google profile"), null);
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log("✅ Existing Gmail user:", email);
      return done(null, existingUser);
    }

    // New Google user — prepare a tempUser object for inline onboarding
    const tempUser = {
      googleId: profile.id,
      email,
      profilePic: profile._json?.picture || "",
      name: profile.displayName || "",
      source: "google",
      verified: true // trust Google email as verified by default
    };

    // If `req` is available (passReqToCallback: true), persist tempUser into session
    // This makes the later callback handler simple: read req.session.tempUser
    if (req && req.session) {
      req.session.tempUser = tempUser;
      // Do NOT call done with a user; tell Passport to continue without logging in
      // returning done(null, false, { tempUser }) is optional; storing in session is reliable
      return done(null, false, { tempUser });
    }

    // Fallback: pass tempUser via authInfo
    return done(null, false, { tempUser });

  } catch (err) {
    console.log("❌ Error during Google OAuth:", err);
    return done(err, null);
  }
}));
