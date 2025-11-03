const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/user");

// Use passport-local-mongoose provided strategy/serializers
passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

const pickPicture = (profile) => {
  return (
    profile?._json?.picture ||
    profile?._json?.imageUrl ||
    (Array.isArray(profile?.photos) && profile.photos[0]?.value) ||
    "/images/default-avatar.png"
  );
};

// Google OAuth strategy (passReqToCallback = true to access req & session)
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
        const rawEmail = profile?.emails?.[0]?.value || profile?._json?.email;
        const email = rawEmail ? String(rawEmail).toLowerCase().trim() : null;
        const googleId = profile.id;
        const picture = pickPicture(profile);

        if (!email) {
          console.log("❌ Google profile has no email:", profile);
          return done(new Error("No email in Google profile"), null);
        }

        const buildTempUser = () => ({
          googleId,
          email,
          profilePic: picture,
          name: profile.displayName || "",
          source: "google",
          verified: true,
        });

        // 1) If an authenticated user explicitly requested attach -> link Google to that user
        if (req && req.user && req.session && req.session.attachGoogle) {
          try {
            req.user.googleId = googleId;
            req.user.profilePic = picture || req.user.profilePic || "/images/default-avatar.png";
            req.user.verified = true;
            await req.user.save();

            // clear attach flag and persist session
            delete req.session.attachGoogle;
            if (typeof req.session.save === "function") {
              await new Promise((resolve, reject) =>
                req.session.save((err) => (err ? reject(err) : resolve()))
              );
            }

            console.log("✅ Attached Google to logged-in user:", req.user.username || req.user.email);
            return done(null, req.user);
          } catch (attachErr) {
            console.error("❌ Error attaching Google to logged-in user:", attachErr);
            return done(attachErr, null);
          }
        }

        // 2) If a user exists already with this googleId and there's no attach intent -> log them in
        const existingByGoogleId = await User.findOne({ googleId });
        if (existingByGoogleId && !(req && req.session && req.session.attachGoogle)) {
          console.log("✅ Existing user found by googleId:", googleId);
          return done(null, existingByGoogleId);
        }

        // 3) Otherwise: persist a minimal tempUser in session for the create-account step
        const tempUser = buildTempUser();
        if (req && req.session) {
          req.session.tempUser = tempUser;
          if (typeof req.session.save === "function") {
            await new Promise((resolve, reject) =>
              req.session.save((err) => (err ? reject(err) : resolve()))
            );
          }
          console.log("➡️ Stored tempUser in session for onboarding:", tempUser.email);
          return done(null, false, { tempUser });
        }

        // Fallback return (no session available)
        return done(null, false, { tempUser });
      } catch (err) {
        console.log("❌ Error during Google OAuth:", err);
        return done(err, null);
      }
    }
  )
);
