const Listing = require("../public/models/listing.js");
const ExpressError = require("../utils/ExpressError.js");
const { listingSchema } = require("../schema.js");
const Booking = require("../public/models/booking.js");
const { PLATFORM_FEE_PERCENT } = require("./bookings.js");

module.exports.index = async (req, res) => {
    const allListings = await Listing.find({});
    res.render("listings/index.ejs", {allListings});
}

module.exports.renderNewForm = (req, res) => {
    res.render("listings/new.ejs");
}

module.exports.showListing = async (req, res) => {
    let {id} = req.params;
    const listing = await Listing.findById(id)
        .populate({
            path: "reviews",
            populate: {
                path: "author",
            },
        })
        .populate("owner");
    if(!listing) {
      req.flash("error", "Listing you requested for does not exist!");
      return res.redirect("/listings");
    }
    const confirmedBookings = await Booking.find({
      listing: listing._id,
      bookingStatus: "confirmed",
      checkOut: { $gt: new Date() },
    }).select("checkIn checkOut -_id").lean();
    const bookedDates = confirmedBookings.map(booking => ({
      checkIn: booking.checkIn.toISOString().slice(0, 10),
      checkOut: booking.checkOut.toISOString().slice(0, 10),
    }));
    res.render("listings/show.ejs", { listing, bookedDates, platformFeePercent: PLATFORM_FEE_PERCENT });
}

module.exports.createListing = async (req, res, next) => {
    let url = req.file.path;
    let filename = req.file.filename;
    const newListing = new Listing(req.body.listing);
    newListing.owner = req.user._id;
    newListing.image = { url, filename };
    await newListing.save();
    req.flash("success", "New Listing Created!");
    res.redirect("/listings");
}


module.exports.editListing = async (req, res) => {
  try {
    const { id } = req.params;

    // 🔹 Debug logs
    console.log("Edit route hit. Listing ID:", id);

    const listing = await Listing.findById(id);
    console.log("Listing found:", listing);

    if (!listing) {
      req.flash("error", "Listing not found!");
      return res.redirect("/listings");
    }

    // 🔹 Null-safe original image (must include this!)
    const orignalImageUrl = listing.image?.url || "/images/default.jpg";

    // Render edit page
    res.render("listings/edit", { listing, orignalImageUrl });
  } catch (err) {
    console.error("Error in editListing controller:", err);
    req.flash("error", "Something went wrong while loading the edit page.");
    res.redirect("/listings");
  }
};



module.exports.updateListing = async (req, res) => {
    let {id} = req.params;
    let listing = await Listing.findByIdAndUpdate(id, {...req.body.listing});

    if(typeof req.file !== "undefined") {
        let url = req.file.path;
        let filename = req.file.filename;
        listing.image = { url, filename };
        await listing.save();
    }

    req.flash("success", "Listing Updated!");
    res.redirect(`/listings/${id}`);
}

module.exports.destroyListing = async (req, res) => {
    let {id} = req.params;
    let deletedListing = await Listing.findByIdAndDelete(id);
    console.log(deletedListing);
    req.flash("success", "Listing Deleted!");
    res.redirect("/listings");
}
