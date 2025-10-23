//  Load environment variables (only in development)
if (process.env.NODE_ENV !== "PRODUCTION") {
  require("dotenv").config();
}

//  Required Packages
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./public/models/user");


//  Route Imports
const listingRouter = require("./routes/listing");
const reviewRouter = require("./routes/review");
const userRouter = require("./routes/user");


//  Database Connection
const dbUrl = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/wanderlust";

const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });
    console.log("✅ MongoDB connected!");

    // Start server AFTER DB is connected
    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });

  } catch (err) {
    console.error("❌ MongoDB connection failed. Retrying in 5s...", err.message);
    setTimeout(startServer, 5000);
  }
};

startServer();



//  App Configuration
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "/public")));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));

// Optional: Limit for image uploads or JSON requests
app.use(express.json({ limit: "50mb" }));

//  Global variable (useful for search form, etc.)
app.use((req, res, next) => {
  res.locals.country = null;
  next();
});


//  Session Configuration
const store = MongoStore.create({
  mongoUrl: dbUrl,
  crypto: {
    secret: process.env.SECRET,
  },
  touchAfter: 24 * 3600, // time in seconds
});

store.on("error", (err) => {
  console.error("❌ Mongo Store Error:", err);
});

const sessionOptions = {
  store,
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
    maxAge: 1000 * 60 * 60 * 24 * 7,
    httpOnly: true,
  },
};

app.use(session(sessionOptions));
app.use(flash());


//  Passport Config
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


//  Global Middleware
app.use((req, res, next) => {
  console.log("REQ.USER:", req.user);
  res.locals.currentUser = req.user || null;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});

//  Show a temporary screen until MongoDB connects
let dbConnected = false;

mongoose.connection.on("connected", () => {
  dbConnected = true;
});

app.use((req, res, next) => {
  if (!dbConnected) {
    return res.send("<h2>🕓 Connecting to database... please wait.</h2>");
  }
  next();
});



//  Routes
app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/", userRouter);


//  Demo User (Optional)

// app.get("/demouser", async (req, res) => {
//   let fakeUser = new User({
//     email: "student@gmail.com",
//     username: "demo-student",
//   });
//   let newUser = await User.register(fakeUser, "helloworld");
//   res.send(newUser);
// });


//  404 Handler

app.all("", (req, res, next) => {
  next(new ExpressError(404, "Page Not Found"));
});


//  Error Handler

app.use((err, req, res, next) => {
  const { statusCode = 500 } = err;
  if (!err.message) err.message = "Something went wrong!";
  res.status(statusCode).render("error.ejs", { message: err.message });
});

//  Start Server

// const PORT = process.env.PORT || 8080;
// app.listen(PORT, () => {
//   console.log(`✅ Server running on port ${PORT}`);
// });
