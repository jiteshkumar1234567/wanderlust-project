const express = require("express");
const router = express.Router();
const passport = require("passport");
const User = require("../public/models/user"); // ✅ correct path (not in /public)
const wrapAsync = require("../utils/wrapAsync");

// =========================
// ✅ SIGNUP ROUTES
// =========================

// GET signup form
router.get("/signup", (req, res) => {
  res.render("users/signup");
});

// POST signup form
router.post(
  "/signup",
  wrapAsync(async (req, res, next) => {
    const { username, email, password } = req.body;
    const user = new User({ email, username });

    try {
      const registeredUser = await User.register(user, password);
      req.login(registeredUser, (err) => {
        if (err) return next(err);
        req.flash("success", "Welcome to Wanderlust!");
        res.redirect("/listings");
      });
    } catch (e) {
      req.flash("error", e.message);
      res.redirect("/signup");
    }
  })
);


// =========================
// ✅ LOGIN ROUTES
// =========================

// Login form
router.get("/login", (req, res) => {
  res.render("users/login");
});

// Login logic
router.post(
  "/login",
  passport.authenticate("local", {
    failureFlash: true,
    failureRedirect: "/login",
  }),
  (req, res) => {
    req.flash("success", "Welcome back!");
    res.redirect("/listings");
  }
);

// =========================
// ✅ LOGOUT ROUTE
// =========================
router.post("/logout", (req, res, next) => {
  req.logout(function (err) {
    if (err) return next(err);
    req.flash("success", "You have logged out successfully!");
    res.redirect("/listings");
  });
});

module.exports = router;
