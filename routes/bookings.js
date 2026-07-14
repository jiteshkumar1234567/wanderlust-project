const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn } = require("../middleware");
const bookings = require("../controllers/bookings");

router.use(isLoggedIn);
router.get("/", wrapAsync(bookings.index));
router.post("/create-order", wrapAsync(bookings.createOrder));
router.post("/verify-payment", wrapAsync(bookings.verifyPayment));
router.post("/payment-failed", wrapAsync(bookings.paymentFailed));
router.get("/:id/success", wrapAsync(bookings.success));
router.post("/:id/cancel", wrapAsync(bookings.cancel));
router.get("/:id", wrapAsync(bookings.show));

module.exports = router;
