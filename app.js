if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError.js");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");

// ✅ Load Google OAuth config
require("./config/passport");

const postRouter = require("./routes/post.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");
const authRouter = require("./routes/auth.js"); // ✅ Google login routes
const verifyRouter = require("./routes/verify");

const dbUrl = process.env.ATLASDB_URL;

main().then(() => {
  console.log("✅ Connected to DB");
}).catch((err) => {
  console.log("❌ DB Connection Error:", err);
});

async function main() {
  await mongoose.connect(dbUrl);
}

app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "/public")));


const store = MongoStore.create({
  mongoUrl: dbUrl,
  crypto: {
    secret: process.env.SECRET,
  },
  touchAfter: 24 * 3600,
});

store.on("error", (err) => {
  console.log("❌ Mongo Session Store Error:", err);
});

const sessionOptions = {
  store,
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
  },
};

app.use(session(sessionOptions));
app.use(flash());

// ✅ Passport setup
app.use(passport.initialize());
app.use(passport.session());

// ✅ LocalStrategy for username/password
passport.use(new LocalStrategy(User.authenticate()));
// passport.serializeUser(User.serializeUser());
// passport.deserializeUser(User.deserializeUser());

passport.serializeUser((user, done) => {
  console.log("🔐 Serializing user:", user._id); // Should be a valid ObjectId
  done(null, user._id);
});


passport.deserializeUser(async (id, done) => {
  console.log("🔍 Deserializing user with ID:", id);
  if (!mongoose.Types.ObjectId.isValid(id)) {
    console.log("❌ Invalid ObjectId:", id);
    return done(null, false); // Skip deserialization
  }
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});


// ✅ Make user and flash messages available in views
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user || null;
  next();
});

// ✅ Routes
app.get("/", (req, res) => {
  res.redirect("/posts");
});

app.use("/auth", authRouter); // ✅ Google login
app.use("/posts", postRouter);
app.use("/posts", reviewRouter);
app.use("/", userRouter);
app.use("/verify", verifyRouter);

// ✅ Debug unmatched requests
app.use((req, res, next) => {
  res.on("finish", () => {
    if (res.statusCode === 404) {
      console.log("Unmatched request:", req.method, req.originalUrl);
    }
  });
  next();
});

// ✅ Chrome DevTools ping
app.get("/.well-known/appspecific/com.chrome.devtools.json", (req, res) => {
  res.status(204).end();
});

// ✅ Error handling
app.all("*", (req, res, next) => {
  next(new ExpressError(404, "Page not found"));
});

app.use((err, req, res, next) => {
  console.log("❌ ERROR STACK", err);
  const { statusCode = 500, message = "Something went wrong" } = err;
  res.status(statusCode).render("error.ejs", { message });
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`🚀 InfoPics is running on port ${port}`);
});


