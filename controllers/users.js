const User = require("../public/models/user.js");

module.exports.renderSignupForm =  (req,res) =>{
    res.render("users/signup.ejs");
};
module.exports.signup = async(req,res) =>{
    try{
             let{username , email , password} = req.body;
 const newUser = new User({email,username});
 const registeredUser =  await User.register(newUser , password);
 console.log(registeredUser);
 req.login(registeredUser,(err) =>{
          if(err){
          return next(err);
        }
        req.flash("success" , "WELCOME YOUR ACCOUNT WAS CREATED!");
        console.log("USER LOGGED IN");
        res.redirect("/listings");
 })
    }catch(e){
        req.flash("error" , e.message);
        res.redirect("/signup");
    }
};

module.exports.renderLoginForm =  (req,res) =>{
    res.render("users/login.ejs");
};

module.exports.login = async(req,res) =>{
     console.log("USER LOGGED IN ");
req.flash("success","WELCOME BACK TO WANDER LUST!");
let redirectUrl = res.locals.redirectUrl || "/listings";
 res.redirect(redirectUrl);
};

module.exports.logout = (req,res,next) =>{
    req.logout((err) =>{
        if(err){
          return next(err);
        }
        req.flash("success" , "YOU ARE LOGGED OUT!");
        console.log("USER LOGGED OUT");
        res.redirect("/listings");
    })
};