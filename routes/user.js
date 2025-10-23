const express = require("express");
const router = express.Router();
// const User = require("../public/models/user.js");
const wrapAsync = require("../utils/wrapAsync");
const passport = require("passport");
const {saveRedirectUrl} = require("../middleware.js");

const userController = require("../controllers/users.js");

router
.route("/signup")
//Render signup form
.get(userController.renderSignupForm)
//Register the user to the database  //50/10; 
.post(wrapAsync(userController.signup));


 router
 .route("/login")          
 //Render login page             
.get(userController.renderLoginForm)
// For login
.post(saveRedirectUrl, passport.authenticate('local', { failureRedirect: '/login', failureFlash: true}),
userController.login);

router.get("/logout", userController.logout);

module.exports = router;