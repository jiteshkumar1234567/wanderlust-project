const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn, isOwner, validateListing } = require("../middleware.js");
const listingController = require("../controllers/listings.js");
const multer = require("multer");
const { storage } = require("../cloudcofig.js");
const upload = multer({ storage });
const Listing = require("../public/models/listing.js"); //  make sure this line exists!


//  INDEX + CREATE

router
  .route("/")
.get(async (req, res, next) => {
  try {
    const allListings = await Listing.find({});
    res.render("listings/index", { 
      allListings, 
      listings: allListings, 
      country: null,
      currentUser: req.user || null
    });
  } catch (err) {
    next(err); // Express error handler ko bhej de
  }
})
.post(
  isLoggedIn,
  upload.single("listing[image]"),
  (req, res, next) => {
    console.log(req.body); // 👈 Add this line
    next();
  },
  validateListing,
  wrapAsync(listingController.createListing)
);



//  NEW LISTING FORM (must come before /:id)

router.get("/new", isLoggedIn, listingController.renderNewForm);


//  EDIT ROUTE

 router.get("/:id/edit", isLoggedIn, isOwner, wrapAsync(listingController.editListing));


//  SEARCH BY COUNTRY
router.get(
  "/search",
  wrapAsync(async (req, res) => {
    const { country } = req.query;
    let listings;

    if (country && country.trim() !== "") {
      listings = await Listing.find({ country: { $regex: new RegExp(country, "i") } });

      //  If no listings found
      if (listings.length === 0) {
        req.flash("error", `No listings found for "${country}".`);
        return res.redirect("/listings");
      }
    } else {
      //  If no country entered, redirect with message
      req.flash("error", "Please enter a country name to search.");
      return res.redirect("/listings");
    }

    //  Pass both `listings` and `allListings`
    res.render("listings/index", { listings, allListings: listings, country });
  })
);


//  FILTER BY CATEGORY
router.get(
  "/category/:category",
  wrapAsync(async (req, res) => {
    const { category } = req.params;

    // Find all listings that match the clicked category
    const listings = await Listing.find({ category });

    if (listings.length === 0) {
      req.flash("error", `No listings found in "${category}" category.`);
      return res.redirect("/listings");
    }

    // Pass category to EJS so heading shows
    res.render("listings/index", {
      listings,
      allListings: listings,
      country: null,
      category,
    });
  })
);



//  SHOW / UPDATE / DELETE ROUTES

router
  .route("/:id")
  .get(wrapAsync(listingController.showListing))

  
  .delete(isLoggedIn, isOwner, wrapAsync(listingController.deleteListing));



  //update route
  router.put(
  "/:id",
  isLoggedIn,
  isOwner,
  upload.single("listing[image]"),
  validateListing,
  wrapAsync(async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findByIdAndUpdate(id, { ...req.body.listing });
    if (req.file) {
      listing.image = { url: req.file.path, filename: req.file.filename };
      await listing.save();
    }
    req.flash("success", "✅ Listing updated successfully!");
    res.redirect(`/listings/${listing._id}`);
  })
);


module.exports = router;


