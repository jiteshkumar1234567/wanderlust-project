const Listing = require("../public/models/listing");

module.exports.index = async (req, res) => {
  const allListings = await Listing.find({});
  res.render("listings/index.ejs", { allListings });
}

module.exports.renderNewForm = (req, res) => {
    if(!req.isAuthenticated()){
    req.flash("error" , "YOU MUST BE LOGGED IN !");
   return  res.redirect("/login");
  }
  res.render("listings/new.ejs");
}

module.exports.showListing = async (req, res) => {
  let { id } = req.params;
  const listing = await Listing.findById(id).populate({path:"reviews" , populate:{path: "author"},
  })
  .populate("owner");
  if(!listing){
  req.flash("error" , "❌ LISTING YOU REQUESTED,IT DOES NOT EXIST!");
 return res.redirect("/listings");
  }
  console.log(listing);
  res.render("listings/show.ejs", { listing, currUser: req.user});
}

module.exports.createListing = async (req, res) => {
  let url = req.file.path;
  let filename = req.file.filename;
  console.log(url, "...", filename);
  const newListing = new Listing(req.body.listing);

  // ✅ Important: assign image as object
  if (req.body.listing.image) {
    newListing.image = {
      url: req.body.listing.image,
      filename: "manual"
    };
  } else {
    newListing.image = {
      url: "https://via.placeholder.com/400",
      filename: "placeholder"
    };
  }
  newListing.owner = req.user._id;
  newListing.image = {url,filename};
  await newListing.save();
  req.flash("success", "✅ NEW LISTING ADDED!");
  res.redirect("/listings");
}


//  Edit Listing Route
module.exports.editListing = async (req, res) => {
  const { id } = req.params;

  const listing = await Listing.findById(id);

  if (!listing) {
    req.flash("error", "❌ Listing not found!");
    return res.redirect("/listings");
  }

  // Render edit form with listing
  let orignalImageUrl =   listing.image.url;
 orignalImageUrl = orignalImageUrl.replace("/uplaod" , "/uplaod/h_300,w_250")
 res.render("listings/edit.ejs", { listing ,currUser: req.user , orignalImageUrl});
};


//  Update Listing Route
module.exports.updateListing = async (req, res) => {
  const { id } = req.params;

  // Validate that category exists in req.body
  if (!req.body.listing.category || req.body.listing.category.trim() === "") {
    req.flash("error", "❌ Category is required!");
    return res.redirect(`/listings/${id}/edit`);
  }

  // Find the listing and update
  const listing = await Listing.findByIdAndUpdate(id, { ...req.body.listing }, { new: true });

  if (!listing) {
    req.flash("error", "❌ Listing not found!");
    return res.redirect("/listings");
  }

  // Handle new image if uploaded
  if (req.file) {
    listing.image = { url: req.file.path, filename: req.file.filename };
    await listing.save();
  }

  req.flash("success", "✅ Listing updated successfully!");
  res.redirect(`/listings/${listing._id}`);
};


  module.exports.deleteListing = async (req, res) => {
  let { id } = req.params;
  let deletedListing = await Listing.findByIdAndDelete(id);
  console.log(deletedListing);
   req.flash("success" , "❌ OLD LISTING DELETED!");
  res.redirect("/listings");
}