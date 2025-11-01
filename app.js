if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const express = require("express");
const app = express();
app.set("trust proxy", 1);
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError.js");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const passport = require("passport");

// ✅ Load Passport strategies and serialization BEFORE passport.initialize()
require("./config/passport");

// ✅ Routers
const postRouter = require("./routes/post.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");
const authRouter = require("./routes/auth.js");
const verifyRouter = require("./routes/verify.js");

// ✅ Database Connection
const dbUrl = process.env.ATLASDB_URL.replace("infopics", "InfoPics");
main()
  .then(() => console.log("✅ Connected to DB"))
  .catch((err) => console.log("❌ DB Connection Error:", err));

async function main() {
  await mongoose.connect(dbUrl);
}

// ✅ App Config
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "/public")));

// ✅ Request Logger
app.use((req, res, next) => {
  console.log(`📥 Incoming request: ${req.method} ${req.originalUrl}`);
  next();
});

// ✅ Session Store
const store = MongoStore.create({
  mongoUrl: dbUrl,
  crypto: { secret: process.env.SECRET },
  touchAfter: 24 * 3600,
});

store.on("error", (err) => console.log("❌ Mongo Session Store Error:", err));

const sessionOptions = {
  store,
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
};

app.use(session(sessionOptions));
app.use(flash());

// ✅ Passport initialization (strategies already loaded above)
app.use(passport.initialize());
app.use(passport.session());

// ✅ Global Middleware — expose useful locals to views including session/pendingId/tempUser
app.use((req, res, next) => {
  console.log("🔍 Session passport user:", req.session.passport?.user);
  console.log("🔍 Current req.user:", req.user);

  // flash messages
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");

  // authenticated user
  res.locals.currUser = req.user || null;

  // expose session for templates and small helpers (avoid dumping secrets there)
  res.locals.session = req.session || {};

  // convenience: expose pendingId and tempUser top-level too
  res.locals.pendingId = req.session?.pendingId || null;
  res.locals.tempUser = req.session?.tempUser || null;

  // provide app base url to views if needed
  res.locals.APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

  next();
});

// ✅ Routes
app.get("/", (req, res) => res.redirect("/posts"));
app.use("/auth", authRouter);
app.use("/verify", verifyRouter);
app.use("/posts", postRouter);
app.use("/posts", reviewRouter);
app.use("/", userRouter);

// ✅ Debug unmatched routes
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

// ✅ Test Session Route
app.get("/test-session", (req, res) => {
  console.log("🧪 Session object:", req.session);
  console.log("🧪 req.user:", req.user);
  console.log("🔐 Authenticated:", req.isAuthenticated());
  res.send("Session test complete");
});

// ✅ Error Handling
app.all("*", (req, res, next) => {
  console.log("🔍 Unmatched route requested:", req.method, req.originalUrl);
  next(new ExpressError(404, "Page not found"));
});

app.use((err, req, res, next) => {
  console.log("❌ ERROR STACK", err);
  const { statusCode = 500, message = "Something went wrong" } = err;
  res.status(statusCode).render("error.ejs", { message });
});

// ✅ Start Server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 InfoPics is running on port ${port}`);
});
