// Load environment variables only in development
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

// -------------------- Required Packages --------------------
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const ExpressError = require("./utils/ExpressError.js");
const User = require("./public/models/user.js");


// -------------------- Routes --------------------
const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");
const bookingRouter = require("./routes/bookings.js");
const hostBookingRouter = require("./routes/hostBookings.js");


// -------------------- MongoDB Connection --------------------
const dbUrl = process.env.MONGO_URL; 
// fallback for local testing
async function connectWithRetry() {
  try {
    await mongoose.connect(dbUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB Connected Successfully!");
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err.message);

    // Retry after 10 sec... (10000 ms)
    console.log("⏳ Retrying MongoDB connection in 10 sec...");
    setTimeout(connectWithRetry, 10000);
  }
}
// -------------------- App Configurations --------------------
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

// -------------------- Session Configuration --------------------
const secret = process.env.SECRET;

const store = MongoStore.create({
  mongoUrl: dbUrl,
  crypto: { secret },
  touchAfter: 24 * 3600, // 1 day
});

store.on("error", (err) => {
  console.log("❌ SESSION STORE ERROR:", err);
});

const sessionOptions = {
  store,
  secret:process.env.SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 1000 * 60 * 60 * 24 * 7, // 1 week
    maxAge: 1000 * 60 * 60 * 24 * 7,
    httpOnly: true,
  },
};

app.use(session(sessionOptions));
app.use(flash());

// -------------------- Passport Configuration --------------------
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// -------------------- Flash & Current User Middleware --------------------
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  res.locals.path = req.path;
  next();
});

// -------------------- Routes --------------------
app.get("/", (req, res) => {
  res.redirect("/listings");
});

app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/", userRouter);
app.use("/bookings", bookingRouter);
app.use("/host/bookings", hostBookingRouter);



// -------------------- Error Handling --------------------
app.all("*splat", (req, res, next) => {
  next(new ExpressError(404, "Page Not Found!"));
});

app.use((err, req, res, next) => {
  const { statusCode = 500 } = err;
  if (!err.message) err.message = "Something went wrong!";
  res.status(statusCode).render("error.ejs", { err, status: statusCode, message: err.message });
});





// -------------------- Start Server --------------------
const PORT = process.env.PORT || 8080;
if (require.main === module) {
  connectWithRetry();
  app.listen(PORT, () => {
  console.log(`🚀 Server is listening on port ${PORT}`);
  });
}

module.exports = app;
