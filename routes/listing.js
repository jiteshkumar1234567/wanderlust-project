const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn, isOwner, validateListing } = require("../middleware.js");
const listingController = require("../controllers/listings.js");
const multer = require("multer");
const { storage } = require("../cloudcofig.js");
const upload = multer({ storage });
const Listing = require("../public/models/listing.js");
const Booking = require("../public/models/booking.js");

async function renderExplore(req, res, query = {}) {
  const { sort = "featured", minPrice, maxPrice } = req.query;
  if (minPrice !== undefined || maxPrice !== undefined) {
    query.price = {};
    if (minPrice !== "" && Number.isFinite(Number(minPrice))) query.price.$gte = Number(minPrice);
    if (maxPrice !== "" && Number.isFinite(Number(maxPrice))) query.price.$lte = Number(maxPrice);
    if (!Object.keys(query.price).length) delete query.price;
  }
  let mongoQuery = Listing.find(query).populate("reviews");
  if (sort === "price-asc") mongoQuery = mongoQuery.sort({ price: 1 });
  else if (sort === "price-desc") mongoQuery = mongoQuery.sort({ price: -1 });
  else if (sort === "newest") mongoQuery = mongoQuery.sort({ _id: -1 });
  const allListings = await mongoQuery;
  res.render("listings/index", {
    allListings,
    listings: allListings,
    country: req.query.country || null,
    activeCategory: query.category || null,
    filters: { sort, minPrice: minPrice || "", maxPrice: maxPrice || "" },
  });
}

// INDEX + CREATE
router
  .route("/")
  .get(
    wrapAsync(async (req, res) => renderExplore(req, res))
  )
  .post(
    isLoggedIn,
    upload.single("listing[image]"),
    validateListing,
    wrapAsync(listingController.createListing)
  );

// NEW FORM
router.get("/new", isLoggedIn, listingController.renderNewForm);

router.get("/mine", isLoggedIn, wrapAsync(async (req, res) => {
  const listings = await Listing.find({ owner: req.user._id }).sort({ _id: -1 });
  const bookings = await Booking.find({ host: req.user._id, paymentStatus: "paid", bookingStatus: { $in: ["confirmed", "completed"] } });
  const revenue = bookings.reduce((sum, booking) => sum + booking.totalAmount, 0);
  res.render("listings/mine", {
    listings,
    stats: { totalListings: listings.length, totalBookings: bookings.length, revenue },
  });
}));

// EDIT FORM
router.get("/:id/edit", isLoggedIn, isOwner, wrapAsync(listingController.editListing));

// SEARCH BY COUNTRY
router.get(
  "/search",
  wrapAsync(async (req, res) => {
    const { country, checkIn, checkOut, guests } = req.query;
    let listings;

    if (country && country.trim() !== "") {
      listings = await Listing.find({ country: { $regex: new RegExp(country, "i") } }).populate("reviews");

      if (checkIn && checkOut) {
        const start = new Date(`${checkIn}T00:00:00.000Z`);
        const end = new Date(`${checkOut}T00:00:00.000Z`);
        if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start) {
          const unavailable = await Booking.distinct("listing", {
            bookingStatus: "confirmed",
            checkIn: { $lt: end },
            checkOut: { $gt: start },
          });
          listings = listings.filter(listing => !unavailable.some(id => id.equals(listing._id)));
        }
      }

      if (listings.length === 0) {
        req.flash("error", `No listings found for "${country}".`);
        return res.redirect("/listings");
      }
    } else {
      req.flash("error", "Please enter a country name to search.");
      return res.redirect("/listings");
    }

    req.query.country = country;
    res.render("listings/index", { listings, allListings: listings, country, searchDates: { checkIn, checkOut, guests }, activeCategory: null, filters: { sort: "featured", minPrice: "", maxPrice: "" } });
  })
);

// FILTER BY CATEGORY
router.get(
  "/category/:category",
  wrapAsync(async (req, res) => {
    const { category } = req.params;
    const listings = await Listing.find({ category }).populate("reviews");

    if (listings.length === 0) {
      req.flash("error", `No listings found in "${category}" category.`);
      return res.redirect("/listings");
    }

    res.render("listings/index", {
      listings,
      allListings: listings,
      country: null,
      category,
      activeCategory: category,
      filters: { sort: "featured", minPrice: "", maxPrice: "" },
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
