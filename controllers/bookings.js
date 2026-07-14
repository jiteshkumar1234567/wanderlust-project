const crypto = require("crypto");
const mongoose = require("mongoose");
const Booking = require("../public/models/booking");
const Listing = require("../public/models/listing");
const ExpressError = require("../utils/ExpressError");
const { getRazorpay } = require("../services/razorpay");

const configuredFee = Number(process.env.PLATFORM_FEE_PERCENT || 10);
const PLATFORM_FEE_PERCENT = Number.isFinite(configuredFee) && configuredFee >= 0 ? configuredFee : 10;
const DAY_MS = 24 * 60 * 60 * 1000;

function apiError(res, status, message) {
  return res.status(status).json({ success: false, message });
}

function parseBookingInput(body) {
  const { listingId, checkIn, checkOut } = body;
  const guests = Number(body.guests);
  if (!mongoose.isValidObjectId(listingId)) throw new ExpressError(400, "Invalid listing ID.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn || "") || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut || "")) {
    throw new ExpressError(400, "Please provide valid check-in and check-out dates.");
  }
  const start = new Date(`${checkIn}T00:00:00.000Z`);
  const end = new Date(`${checkOut}T00:00:00.000Z`);
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  if (start < todayUtc) throw new ExpressError(400, "Check-in must be today or a future date.");
  if (end <= start) throw new ExpressError(400, "Check-out must be after check-in.");
  if (!Number.isInteger(guests) || guests < 1) throw new ExpressError(400, "Guests must be at least 1.");
  return { listingId, checkIn: start, checkOut: end, guests, numberOfNights: Math.round((end - start) / DAY_MS) };
}

async function findOverlap(listing, checkIn, checkOut, excludeId) {
  const query = {
    listing,
    bookingStatus: "confirmed",
    checkIn: { $lt: checkOut },
    checkOut: { $gt: checkIn },
  };
  if (excludeId) query._id = { $ne: excludeId };
  return Booking.exists(query);
}

module.exports.createOrder = async (req, res) => {
  try {
    const input = parseBookingInput(req.body);
    const listing = await Listing.findById(input.listingId).populate("owner");
    if (!listing) return apiError(res, 404, "Listing not found.");
    if (!listing.owner) return apiError(res, 400, "This listing has no valid host.");
    if (await findOverlap(listing._id, input.checkIn, input.checkOut)) {
      return apiError(res, 409, "This property is already booked for the selected dates.");
    }

    const pricePerNight = Number(listing.price);
    if (!Number.isFinite(pricePerNight) || pricePerNight <= 0) return apiError(res, 400, "Listing must have a valid price above zero.");
    const subtotal = Math.round(pricePerNight * input.numberOfNights * 100) / 100;
    const platformFee = Math.round(subtotal * PLATFORM_FEE_PERCENT) / 100;
    const totalAmount = Math.round((subtotal + platformFee) * 100) / 100;
    const amount = Math.round(totalAmount * 100);

    let booking = await Booking.findOne({
      user: req.user._id,
      listing: listing._id,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      guests: input.guests,
      bookingStatus: "pending",
      paymentStatus: { $in: ["pending", "failed"] },
      razorpayOrderId: { $exists: true, $ne: null },
    }).sort({ createdAt: -1 });

    if (!booking) {
      const receipt = `wl_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      const order = await getRazorpay().orders.create({ amount, currency: "INR", receipt });
      booking = await Booking.create({
        user: req.user._id, listing: listing._id, host: listing.owner._id,
        checkIn: input.checkIn, checkOut: input.checkOut, guests: input.guests,
        numberOfNights: input.numberOfNights, pricePerNight, subtotal, platformFee,
        totalAmount, currency: order.currency, razorpayOrderId: order.id,
      });
    } else if (booking.paymentStatus === "failed") {
      booking.paymentStatus = "pending";
      await booking.save();
    }

    return res.json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
      razorpayOrderId: booking.razorpayOrderId,
      amount: Math.round(booking.totalAmount * 100),
      currency: booking.currency,
      bookingId: booking._id,
      listing: { id: listing._id, title: listing.title, image: listing.image, location: listing.location },
      user: { name: req.user.username, email: req.user.email },
    });
  } catch (err) {
    console.error("Create booking order error:", err.message);
    return apiError(res, err.statusCode || 500, err.statusCode ? err.message : "Unable to start payment. Please try again.");
  }
};

module.exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;
    if (!mongoose.isValidObjectId(bookingId)) return apiError(res, 400, "Invalid booking ID.");
    if (![razorpay_order_id, razorpay_payment_id, razorpay_signature].every(v => typeof v === "string" && v)) {
      return apiError(res, 400, "Incomplete payment verification data.");
    }
    const booking = await Booking.findOne({ _id: bookingId, user: req.user._id });
    if (!booking) return apiError(res, 404, "Booking not found.");
    if (booking.paymentStatus === "paid") {
      if (booking.razorpayPaymentId !== razorpay_payment_id) return apiError(res, 409, "Booking is already linked to another payment.");
      return res.json({ success: true, redirectUrl: `/bookings/${booking._id}/success` });
    }
    if (booking.razorpayOrderId !== razorpay_order_id) return apiError(res, 400, "Payment order does not match this booking.");

    const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
      .update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
    const valid = expected.length === razorpay_signature.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature));
    if (!valid) return apiError(res, 400, "Payment signature verification failed.");
    if (await findOverlap(booking.listing, booking.checkIn, booking.checkOut, booking._id)) {
      booking.paymentStatus = "failed";
      await booking.save();
      return apiError(res, 409, "The property became unavailable before payment confirmation. Please contact support with your payment ID.");
    }

    booking.bookingStatus = "confirmed";
    booking.paymentStatus = "paid";
    booking.razorpayPaymentId = razorpay_payment_id;
    booking.razorpaySignature = razorpay_signature;
    await booking.save();
    return res.json({ success: true, redirectUrl: `/bookings/${booking._id}/success` });
  } catch (err) {
    if (err && err.code === 11000) return apiError(res, 409, "This payment has already been used.");
    console.error("Verify payment error:", err.message);
    return apiError(res, 500, "Payment verification failed. Please contact support if money was deducted.");
  }
};

module.exports.paymentFailed = async (req, res) => {
  if (!mongoose.isValidObjectId(req.body.bookingId)) return apiError(res, 400, "Invalid booking ID.");
  const booking = await Booking.findOne({ _id: req.body.bookingId, user: req.user._id, paymentStatus: { $ne: "paid" } });
  if (booking) { booking.paymentStatus = "failed"; await booking.save(); }
  return res.json({ success: true, message: "Payment failed. Your booking has not been confirmed." });
};

module.exports.index = async (req, res) => {
  const bookings = await Booking.find({ user: req.user._id }).populate("listing").sort({ createdAt: -1 });
  res.render("bookings/index", { bookings });
};

async function accessibleBooking(req) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ExpressError(400, "Invalid booking ID.");
  const booking = await Booking.findById(req.params.id).populate("listing").populate("user").populate("host");
  if (!booking) throw new ExpressError(404, "Booking not found.");
  const allowed = booking.user?._id?.equals(req.user._id) || booking.host?._id?.equals(req.user._id) || req.user.role === "admin";
  if (!allowed) throw new ExpressError(403, "You are not allowed to view this booking.");
  return booking;
}

module.exports.show = async (req, res) => res.render("bookings/show", { booking: await accessibleBooking(req) });

module.exports.success = async (req, res) => {
  const booking = await accessibleBooking(req);
  if (booking.paymentStatus !== "paid") throw new ExpressError(403, "This booking has not been paid.");
  res.render("bookings/success", { booking });
};

module.exports.cancel = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ExpressError(400, "Invalid booking ID.");
  const booking = await Booking.findOne({ _id: req.params.id, user: req.user._id });
  if (!booking) throw new ExpressError(404, "Booking not found or you cannot cancel it.");
  if (["cancelled", "completed"].includes(booking.bookingStatus)) throw new ExpressError(400, `A ${booking.bookingStatus} booking cannot be cancelled.`);
  if (booking.checkIn <= new Date()) throw new ExpressError(400, "Bookings cannot be cancelled on or after check-in.");
  booking.bookingStatus = "cancelled";
  await booking.save();
  req.flash("success", "Booking cancelled. No automatic refund was issued; contact support if payment was made.");
  res.redirect("/bookings");
};

module.exports.hostIndex = async (req, res) => {
  const bookings = await Booking.find({ host: req.user._id }).populate("listing").populate("user").sort({ createdAt: -1 });
  res.render("bookings/hostBookings", { bookings });
};

module.exports.findOverlap = findOverlap;
module.exports.PLATFORM_FEE_PERCENT = PLATFORM_FEE_PERCENT;
