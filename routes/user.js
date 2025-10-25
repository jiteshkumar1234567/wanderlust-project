// const express = require("express");
// const router = express.Router();
// const wrapAsync = require("../utils/wrapAsync");
// const passport = require("passport");
// const { saveRedirectUrl } = require("../middleware.js");

// const userController = require("../controllers/users.js");
// const { route } = require("./listing");

// router
//     .route("/signup")
//     .get(userController.renderSignupForm)
//     .post(wrapAsync(userController.signup));

// router
//     .route("/login")
//     .get(userController.renderLoginForm)
//     .post(saveRedirectUrl, passport.authenticate("local", { failureRedirect: '/login', failureFlash: true }), userController.login);

// router.get("/logout", userController.logout)

// module.exports = router;








// routes/user.js
const express = require("express");
const router = express.Router();
const passport = require("passport");
const User = require("../public/models/user"); // <-- agar signup/login use kar rahe ho

// Signup route
router.get("/register", (req, res) => {
  res.render("users/register");
});

router.post("/register", async (req, res) => {
  // registration logic...
});

// Login route
router.get("/login", (req, res) => {
  res.render("users/login");
});

router.post(
  "/login",
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  (req, res) => {
    req.flash("success", "Welcome back!");
    res.redirect("/listings");
  }
);

// 🔹 Logout route (yahi add karna hai)
router.post("/logout", (req, res, next) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    req.flash("success", "You have logged out successfully!");
    res.redirect("/listings");
  });
});

module.exports = router;
