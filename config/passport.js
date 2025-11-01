const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/user");

// Use passport-local-mongoose provided strategy/serializers
passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Google OAuth strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const email = profile?.emails?.[0]?.value || profile._json?.email;
        const googleId = profile.id;

        if (!email) {
          console.log("❌ Google profile has no email:", profile);
          return done(new Error("No email in Google profile"), null);
        }

        // 1) If a user exists with this googleId, log them in
        const existingByGoogleId = await User.findOne({ googleId });
        if (existingByGoogleId) {
          console.log("✅ Existing user found by googleId:", googleId);
          return done(null, existingByGoogleId);
        }

        // 2) If a user exists with this email but not this googleId,
        // DO NOT auto-login them. Instead prepare a tempUser for inline onboarding.
        // This allows multiple accounts to reuse the same Gmail while keeping username unique.
        const tempUser = {
          googleId,
          email,
          profilePic: profile._json?.picture || "",
          name: profile.displayName || "",
          source: "google",
          verified: true,
        };

        if (req && req.session) {
          req.session.tempUser = tempUser;
          // ensure session persistence before redirecting from auth callback
          if (typeof req.session.save === "function") {
            await new Promise((resolve, reject) =>
              req.session.save((err) => (err ? reject(err) : resolve()))
            );
          }
          return done(null, false, { tempUser });
        }

        return done(null, false, { tempUser });
      } catch (err) {
        console.log("❌ Error during Google OAuth:", err);
        return done(err, null);
      }
    }
  )
);
