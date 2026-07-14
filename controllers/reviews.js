const Review = require("../public/models/review.js");
const Listing = require("../public/models/listing");
module.exports.createReview = async(req,res) =>{
    console.log(req.params.id);
let listing  = await Listing.findById(req.params.id);
let newReview = new Review(req.body.review);
newReview.author = req.user._id;
listing.reviews.push(newReview);

await newReview.save();
await listing.save();

console.log("review saved");
 req.flash("success" , "✅ NEW REVIEW ADDED!");
res.redirect(`/listings/${listing._id}`);
};

module.exports.deleteReview = async (req, res) => {
    const { id, reviewId } = req.params;
    await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
    await Review.findByIdAndDelete(reviewId);
    req.flash("success" , "❌ REVIEW DELETED!");
    res.redirect(`/listings/${id}`);
};