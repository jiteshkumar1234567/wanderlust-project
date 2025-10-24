const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn, isOwner, validateListing } = require("../middleware.js");
const listingController = require("../controllers/listings.js");
const multer = require("multer");
const { storage } = require("../cloudCofig.js");
const upload = multer({ storage });
const Listing = require("../public/models/listing.js");

// INDEX + CREATE
router
  .route("/")
  .get(
    wrapAsync(async (req, res) => {
      const allListings = await Listing.find({});
      res.render("listings/index", {
        allListings,
        listings: allListings,
        country: null,
        currentUser: req.user || null,
      });
    })
  )
  .post(
    isLoggedIn,
    upload.single("listing[image]"),
    validateListing,
    wrapAsync(listingController.createListing)
  );

// NEW FORM
router.get("/new", isLoggedIn, listingController.renderNewForm);

// EDIT FORM
router.get("/:id/edit", isLoggedIn, isOwner, wrapAsync(listingController.editListing));

// SEARCH BY COUNTRY
router.get(
  "/search",
  wrapAsync(async (req, res) => {
    const { country } = req.query;
    let listings;

    if (country && country.trim() !== "") {
      listings = await Listing.find({ country: { $regex: new RegExp(country, "i") } });

      if (listings.length === 0) {
        req.flash("error", `No listings found for "${country}".`);
        return res.redirect("/listings");
      }
    } else {
      req.flash("error", "Please enter a country name to search.");
      return res.redirect("/listings");
    }

    res.render("listings/index", { listings, allListings: listings, country });
  })
);

// FILTER BY CATEGORY
router.get(
  "/category/:category",
  wrapAsync(async (req, res) => {
    const { category } = req.params;
    const listings = await Listing.find({ category });

    if (listings.length === 0) {
      req.flash("error", `No listings found in "${category}" category.`);
      return res.redirect("/listings");
    }

    res.render("listings/index", {
      listings,
      allListings: listings,
      country: null,
      category,
    });
  })
);

// SHOW, UPDATE, DELETE
router
  .route("/:id")
  .get(wrapAsync(listingController.showListing))
  .put(
  isLoggedIn,
  isOwner,
  upload.single("listing[image]"),
  validateListing,
  wrapAsync(async (req, res) => {
    const { id } = req.params;

    // 1. Fetch listing
    const listing = await Listing.findById(id);
    if (!listing) {
      req.flash("error", "Listing not found!");
      return res.redirect("/listings");
    }

    // 2. Check form data exists
    if (!req.body.listing) {
      req.flash("error", "Form data missing!");
      return res.redirect(`/listings/${id}/edit`);
    }

    // 3. Update fields
    const { title, price, description, location, country, category } = req.body.listing;
    listing.title = title;
    listing.price = price;
    listing.description = description;
    listing.location = location;
    listing.country = country;
    listing.category = category;

    // 4. Update image if uploaded
    if (req.file) {
      listing.image = { url: req.file.path, filename: req.file.filename };
    }

    // 5. Save listing
    await listing.save();

    req.flash("success", "✅ Listing updated successfully!");
    res.redirect(`/listings/${listing._id}`);
  })
)
.delete(
    isLoggedIn,
    isOwner,
    wrapAsync(async (req, res) => {
      const { id } = req.params;
      const deletedListing = await Listing.findByIdAndDelete(id);

      if (!deletedListing) {
        req.flash("error", "Listing not found!");
        return res.redirect("/listings");
      }

      req.flash("success", "🗑️ Listing deleted successfully!");
      res.redirect("/listings");
    })
  );

module.exports = router;
