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

        // 1) Attach flow: authenticated user explicitly requested attach -> link Google to that user
        if (req && req.user && req.session && req.session.attachGoogle) {
          try {
            req.user.googleId = googleId;
            req.user.profilePic = picture || req.user.profilePic || "/images/default-avatar.png";
            req.user.verified = true;
            await req.user.save();

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

        // 2) If a user exists with this googleId -> log them in
        const existingByGoogleId = await User.findOne({ googleId });
        if (existingByGoogleId) {
          console.log("✅ Existing user found by googleId:", googleId);
          return done(null, existingByGoogleId);
        }

        // 3) Try to find an existing user by email and link the googleId, or create a new user
        const existingByEmail = await User.findOne({ email });

        if (existingByEmail) {
          existingByEmail.googleId = existingByEmail.googleId || googleId;
          existingByEmail.profilePic = existingByEmail.profilePic || picture || "/images/default-avatar.png";
          existingByEmail.verified = existingByEmail.verified || true;
          await existingByEmail.save();
          console.log("✅ Linked Google to existing user by email:", email);
          return done(null, existingByEmail);
        }

        // 4) No user exists by googleId or email — create one now so the user is logged in immediately.
        const baseUsername = String(email.split("@")[0]).replace(/[^a-z0-9_-]/gi, "").slice(0, 20) || `user${Date.now()}`;
        let finalUsername = baseUsername;
        let suffix = 0;
        while (await User.exists({ username: finalUsername })) {
          suffix += 1;
          finalUsername = `${baseUsername}${suffix}`;
        }

        const newUser = new User({
          email,
          username: finalUsername,
          googleId,
          profilePic: picture || "/images/default-avatar.png",
          verified: true,
        });

        await newUser.save();
        console.log("✅ Created new user from Google profile:", newUser.username);
        return done(null, false, { tempUser: req.session.tempUser });

        // NOTE: tempUser fallback removed because we persist/link/create above.
      } catch (err) {
        console.log("❌ Error during Google OAuth:", err);
        return done(err, null);
      }
    }
  )
);
