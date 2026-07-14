 const Listing = require("./public/models/listing")
 const {listingSchema , reviewSchema} = require("./schema.js");
 const ExpressError = require("./utils/ExpressError");
const Review = require("./public/models/review.js");


 module.exports.isLoggedIn = (req,res,next) =>{
    console.log(req.path , ".." , req.originalUrl);
 if(!req.isAuthenticated()){
    req.session.redirectUrl = req.originalUrl;
    req.flash("error" , "YOU MUST BE LOGGED IN!");
   return  res.redirect("/login");
  }
  next();
 };


 module.exports.saveRedirectUrl = (req,res,next) =>{
    if(req.session.redirectUrl){
        res.locals.redirectUrl = req.session.redirectUrl;
    }
    next();
 }

module.exports.isOwner = async (req,res,next) =>{
  const { id } = req.params;
  const listing = await Listing.findById(id);

  if(!listing){
    req.flash("error", "❌ LISTING NOT FOUND!");
    return res.redirect("/listings");
  }

  // Owner comparison
  if(!listing.owner.equals(req.user._id)){
    req.flash("error", "❌ YOU ARE NOT THE OWNER OF THIS LISTING!");
    return res.redirect(`/listings/${id}`);
  }

  next();
};


module.exports.validateListing = (req,res,next) =>{
let {error} = listingSchema.validate(req.body);

  if(error){
    let errMsg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(400,errMsg);
  }else{
    next();
  }
}



module.exports.validateReview = (req,res,next) =>{
let {error} = reviewSchema.validate(req.body);

  if(error){
    let errMsg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(400,errMsg);
  }else{
    next();
  }
}

module.exports.isReviewAuthor = async (req,res,next) =>{
  const {id, reviewId } = req.params;
  const review = await Review.findById(reviewId);

  if(!review){
    req.flash("error", "❌ LISTING NOT FOUND!");
    return res.redirect("/listings");
  }

  // Owner comparison
  if(!review.author.equals(req.user._id)){
    req.flash("error", "❌ YOU ARE NOT THE AUTHOR OF THIS REVIEW!");
    return res.redirect(`/listings/${id}`);
  }

  next();
};