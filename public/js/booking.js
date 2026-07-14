document.addEventListener("DOMContentLoaded", () => {
  const card = document.getElementById("booking-card");
  if (!card) return;

  const listingId = card.dataset.listingId;
  const price = Number(card.dataset.price);
  const feePercent = Number(card.dataset.feePercent);
  const checkIn = document.getElementById("check-in");
  const checkOut = document.getElementById("check-out");
  const guests = document.getElementById("guests");
  const button = document.getElementById("book-now");
  const alertBox = document.getElementById("booking-alert");
  const bookedDates = JSON.parse(document.getElementById("booked-dates-data")?.textContent || "[]");
  const today = new Date();
  const todayString = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  checkIn.min = todayString;
  checkOut.min = todayString;

  const money = value => `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const showMessage = (message, type = "danger") => {
    alertBox.textContent = message;
    alertBox.className = `booking-alert booking-${type === "danger" ? "error" : type}`;
  };
  const clearMessage = () => { alertBox.className = "booking-alert d-none"; alertBox.textContent = ""; };
  const overlaps = (start, end) => bookedDates.some(range => range.checkIn < end && range.checkOut > start);

  function updatePrice() {
    clearMessage();
    if (!checkIn.value || !checkOut.value) return;
    checkOut.min = checkIn.value;
    const start = new Date(`${checkIn.value}T00:00:00Z`);
    const end = new Date(`${checkOut.value}T00:00:00Z`);
    const nights = Math.round((end - start) / 86400000);
    if (nights < 1) { document.getElementById("price-breakdown").classList.add("d-none"); return showMessage("Check-out must be after check-in."); }
    if (overlaps(checkIn.value, checkOut.value)) showMessage("This property is unavailable for part of the selected date range.");
    const subtotal = Math.round(price * nights * 100) / 100;
    const fee = Math.round(subtotal * feePercent) / 100;
    document.getElementById("night-count").textContent = nights;
    document.getElementById("booking-subtotal").textContent = money(subtotal);
    document.getElementById("booking-fee").textContent = money(fee);
    document.getElementById("booking-total").textContent = money(subtotal + fee);
    document.getElementById("price-breakdown").classList.remove("d-none");
  }

  checkIn.addEventListener("change", updatePrice);
  checkOut.addEventListener("change", updatePrice);
  if (!button) return;

  button.addEventListener("click", async () => {
    clearMessage();
    if (!checkIn.value || !checkOut.value || Number(guests.value) < 1) return showMessage("Choose valid dates and at least one guest.");
    if (checkOut.value <= checkIn.value) return showMessage("Check-out must be after check-in.");
    if (overlaps(checkIn.value, checkOut.value)) return showMessage("This property is already booked for the selected dates.");
    button.disabled = true;
    button.textContent = "Preparing secure checkout…";
    try {
      const response = await fetch("/bookings/create-order", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, checkIn: checkIn.value, checkOut: checkOut.value, guests: Number(guests.value) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to create booking.");
      if (typeof Razorpay === "undefined") throw new Error("Razorpay Checkout could not load. Check your connection and try again.");

      const checkout = new Razorpay({
        key: data.key, amount: data.amount, currency: data.currency, order_id: data.razorpayOrderId,
        name: "Wanderlust", description: `Booking for ${data.listing.title}`,
        prefill: { name: data.user.name || "", email: data.user.email || "" },
        theme: { color: "#fe424d" },
        handler: async payment => {
          const verifyResponse = await fetch("/bookings/verify-payment", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payment, bookingId: data.bookingId }),
          });
          const result = await verifyResponse.json();
          if (!verifyResponse.ok) { showMessage(result.message || "Payment could not be verified."); button.disabled = false; button.textContent = "Retry secure payment"; return; }
          window.location.assign(result.redirectUrl);
        },
        modal: { ondismiss: () => { button.disabled = false; button.textContent = "Reserve / Book Now"; } },
      });
      checkout.on("payment.failed", async event => {
        await fetch("/bookings/payment-failed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId: data.bookingId }) });
        showMessage(event.error?.description || "Payment failed. Your booking has not been confirmed.");
        button.disabled = false; button.textContent = "Reserve / Book Now";
      });
      checkout.open();
    } catch (error) {
      showMessage(error.message);
      button.disabled = false; button.textContent = "Reserve / Book Now";
    }
  });
});
