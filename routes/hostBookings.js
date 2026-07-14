const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn } = require("../middleware");
const bookings = require("../controllers/bookings");

router.get("/", isLoggedIn, wrapAsync(bookings.hostIndex));

module.exports = router;
