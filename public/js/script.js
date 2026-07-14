document.addEventListener("DOMContentLoaded", () => {
  const nav = document.querySelector(".site-nav");
  const setNavState = () => nav?.classList.toggle("nav-scrolled", window.scrollY > 12);
  setNavState();
  window.addEventListener("scroll", setNavState, { passive: true });

  document.querySelectorAll(".needs-validation").forEach(form => {
    form.addEventListener("submit", event => {
      if (!form.checkValidity()) { event.preventDefault(); event.stopPropagation(); }
      form.classList.add("was-validated");
    });
  });

  document.querySelectorAll("[data-dismiss-toast]").forEach(button => button.addEventListener("click", () => button.closest("[data-app-toast]")?.remove()));
  document.querySelectorAll("[data-app-toast]").forEach(toast => setTimeout(() => toast.remove(), toast.classList.contains("toast-error") ? 10000 : 6000));

  document.querySelector("[data-focus-search]")?.addEventListener("click", () => {
    const search = document.querySelector("[data-main-search]");
    if (search) { search.scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(() => search.focus(), 350); }
    else window.location.assign("/listings#stays");
  });

  const journeyCheckIn = document.querySelector('.journey-search input[name="checkIn"]');
  const journeyCheckOut = document.querySelector('.journey-search input[name="checkOut"]');
  if (journeyCheckIn && journeyCheckOut) {
    const now = new Date();
    const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    journeyCheckIn.min = today;
    journeyCheckOut.min = journeyCheckIn.value || today;
    journeyCheckIn.addEventListener("change", () => {
      journeyCheckOut.min = journeyCheckIn.value || today;
      if (journeyCheckOut.value && journeyCheckOut.value <= journeyCheckIn.value) journeyCheckOut.value = "";
    });
  }

  document.querySelectorAll("[data-password-toggle]").forEach(button => button.addEventListener("click", () => {
    const input = button.parentElement.querySelector("input");
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    button.innerHTML = `<i class="fa-regular fa-eye${showing ? "" : "-slash"}"></i>`;
    button.setAttribute("aria-label", showing ? "Show password" : "Hide password");
  }));

  const imageInput = document.querySelector("[data-image-input]");
  const imagePreview = document.querySelector("[data-image-preview]");
  if (imageInput && imagePreview) {
    const resetPreview = () => { imageInput.value = ""; imagePreview.hidden = true; imagePreview.querySelector("img").removeAttribute("src"); };
    imageInput.addEventListener("change", () => {
      const file = imageInput.files[0];
      if (!file) return resetPreview();
      imagePreview.querySelector("img").src = URL.createObjectURL(file);
      imagePreview.hidden = false;
    });
    imagePreview.querySelector("[data-clear-image]")?.addEventListener("click", resetPreview);
  }

  document.querySelector("[data-share-page]")?.addEventListener("click", async event => {
    const button = event.currentTarget;
    try {
      if (navigator.share) await navigator.share({ title: document.title, url: location.href });
      else { await navigator.clipboard.writeText(location.href); button.innerHTML = '<i class="fa-solid fa-check"></i> Link copied'; setTimeout(() => button.innerHTML = '<i class="fa-solid fa-arrow-up-from-bracket"></i> Share', 1800); }
    } catch (_) {}
  });

  const tabs = document.querySelectorAll("[data-booking-tab]");
  const bookingCards = document.querySelectorAll("[data-booking-card]");
  const filteredEmpty = document.querySelector("[data-filter-empty]");
  tabs.forEach(tab => tab.addEventListener("click", () => {
    tabs.forEach(item => item.classList.remove("active")); tab.classList.add("active");
    let visible = 0;
    bookingCards.forEach(card => { const show = tab.dataset.bookingTab === "all" || card.dataset.tabStatus === tab.dataset.bookingTab; card.hidden = !show; if (show) visible += 1; });
    filteredEmpty?.classList.toggle("d-none", visible !== 0);
  }));
  if (tabs.length) tabs[0].click();
  document.querySelectorAll("[data-cancel-form]").forEach(form => form.addEventListener("submit", event => {
    if (!confirm("Cancel this booking? Automatic refunds are not issued by this action.")) event.preventDefault();
  }));
});
