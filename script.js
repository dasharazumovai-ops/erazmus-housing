async function loadAvailabilityFromSheet() {
  const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRKk4VqVA_zVfwQ7nuh-_DiX_TBGW9sr68TZrt0QDn052ql8eBw93AgbG8QpIBPSIGSiKqaDD7Jxct2/pub?gid=0&single=true&output=csv";

  const cacheKey = "eln-availability-cache";
  const cacheTimeKey = "eln-availability-cache-time";
  const cacheDuration = 3 * 60 * 60 * 1000; // 6 hours

  const cachedData = localStorage.getItem(cacheKey);
  const cachedTime = localStorage.getItem(cacheTimeKey);

  if (cachedData) {
    applyAvailabilityData(cachedData);
  }

  const shouldRefresh =
    !cachedTime || Date.now() - Number(cachedTime) > cacheDuration;

  if (!shouldRefresh) {
    return;
  }

  try {
    const response = await fetch(csvUrl);
    const csvText = await response.text();

    localStorage.setItem(cacheKey, csvText);
    localStorage.setItem(cacheTimeKey, Date.now().toString());

    applyAvailabilityData(csvText);
    renderAreaPage();
  } catch (error) {
    console.error("Error loading availability from Google Sheets:", error);
  }
}
function parseCSVRow(row) {
  const cols = [];
  let cur = '', inQ = false;
  for (let i = 0; i < row.length; i++) {
    const c = row[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
    else { cur += c; }
  }
  cols.push(cur.trim());
  return cols;
}

function applyAvailabilityData(csvText) {
  const rows = csvText.trim().split("\n").slice(1); // skip header row

  // Group rows by apartment ID
  const grouped = {};
  rows.forEach(row => {
    const cols = parseCSVRow(row);
    if (cols.length < 3) return;
    const id            = cols[0].trim();
    const availSpots    = Number(cols[1]);
    const totalSpots    = Number(cols[2]);
    const room          = (cols[3] || '').trim();
    const bedType       = (cols[4] || '').trim();
    const notes         = (cols[5] || '').trim();
    const price         = Number(cols[6]) || 0;
    const couplesPrice  = Number(cols[7]) || 0;
    if (!id) return;
    if (!grouped[id]) grouped[id] = { availSpots, totalSpots, rooms: [] };
    if (room) grouped[id].rooms.push({ room, bedType, notes, price, couplesPrice });
  });

  Object.entries(grouped).forEach(([id, data]) => {
    const apt = apartments.find(a => a.apartmentCode === id);
    if (!apt) return;

    apt.availableSpots = data.availSpots;
    apt.totalSpots     = data.totalSpots;

    if (data.rooms.length > 0) {
      // Rebuild roomDetails from sheet
      apt.roomDetails = data.rooms.map(rm => {
        let s = rm.room;
        if (rm.bedType) s += ' – ' + rm.bedType;
        if (rm.notes)   s += ' – ' + rm.notes;
        s += ' – €' + rm.price + '/month';
        if (rm.couplesPrice) s += ' (€' + rm.couplesPrice + '/month for couples)';
        return s;
      });

      // Rebuild price summary
      const prices = data.rooms.map(rm => rm.price).filter(p => p > 0);
      if (prices.length) {
        const min = Math.min(...prices), max = Math.max(...prices);
        apt.price = min === max
          ? '€' + min + ' / month / per room'
          : '€' + min + ' - €' + max + ' / month / per room';
      }
    }
  });
}

function renderApartmentCards(filteredApartments) {
  return filteredApartments.map(apartment => `
    <div class="apartment-card">
      <div class="image-wrapper">
        <img src="${apartment.image}" alt="${apartment.title}">
        <span class="availability-badge ${
          apartment.availableSpots === 0
            ? "status-full"
            : apartment.availableSpots === 1
            ? "status-last"
            : "status-available"
        }">
          ${
            apartment.availableSpots === 0
              ? "Fully booked"
              : apartment.availableSpots === 1
              ? "Last room available"
              : apartment.availableSpots + "/" + apartment.totalSpots + " rooms available"
          }
        </span>
      </div>

      <div class="apartment-card-content">
        <p class="apartment-code">${apartment.apartmentCode}</p>
        <h3>${apartment.title}</h3>
        <p class="price">${apartment.price}</p>
        <p>${apartment.rooms}</p>
        <p>${apartment.description}</p>
        <a href="apartment.html?id=${apartment.id}" class="details-btn">View details</a>
      </div>
    </div>
  `).join("");
}

function sortByAvailability(list) {
  return list.sort((a, b) => {
    const rank = apt => {
      if (apt.availableSpots === apt.totalSpots) return 0;
      if (apt.availableSpots > 0) return 1;
      return 2;
    };
    return rank(a) - rank(b);
  });
}

// Lowest numeric price found in an apartment's price string (handles both
// "€400 / month / per room" and "€425 - €450 / month / per room" formats).
// Used as the representative value when sorting listings by price.
function getApartmentSortPrice(apartment) {
  const matches = String(apartment.price || "").match(/\d+(\.\d+)?/g);
  if (!matches || !matches.length) return null;
  return Math.min(...matches.map(Number));
}

function sortByPrice(list, direction) {
  return list.sort((a, b) => {
    const priceA = getApartmentSortPrice(a);
    const priceB = getApartmentSortPrice(b);

    // Listings with no readable price always sort last, regardless of direction.
    if (priceA === null && priceB === null) return 0;
    if (priceA === null) return 1;
    if (priceB === null) return -1;

    return direction === "desc" ? priceB - priceA : priceA - priceB;
  });
}

// Current price-sort selection: "default" | "asc" | "desc".
// Initialised from the ?sort= URL parameter so a sorted view can be shared/bookmarked.
let currentSort = (function () {
  const value = new URLSearchParams(window.location.search).get("sort");
  return value === "asc" || value === "desc" ? value : "default";
})();

function renderAreaPage() {
  const params = new URLSearchParams(window.location.search);
  const selectedArea = params.get("area");
  const selectedBeds = params.get("beds");

  const areaTitle = document.getElementById("area-title");
  const areaSubtitle = document.getElementById("area-subtitle");
  const apartmentList = document.getElementById("apartment-list");

  if (!areaTitle || !apartmentList) return;

  let filtered;
  let emptyMessage = "No apartments found.";

  // Bedroom search mode (always spans every area)
  if (selectedBeds) {
    const num = parseInt(selectedBeds);
    filtered = apartments.filter(a => {
      const r = a.rooms || "";
      return r.startsWith(num + " bedroom") || r.includes("and " + num + " bedroom") || r.includes(num + " and ");
    });
    areaTitle.textContent = `${num}-Bedroom Apartments`;
    areaSubtitle.textContent = `${filtered.length} apartment${filtered.length !== 1 ? "s" : ""} found`;

  // View-all mode: every apartment, from every area
  } else if (selectedArea === "all") {
    filtered = apartments.slice();
    areaTitle.textContent = "All Apartments";
    areaSubtitle.textContent = `${filtered.length} apartment${filtered.length !== 1 ? "s" : ""} available`;
    emptyMessage = "No apartments found yet.";

  // Area filter mode
  } else if (selectedArea) {
    const areaNames = {
      centre: "City Centre",
      engomi: "Engomi",
      aglantzia: "Aglantzia"
    };

    areaTitle.textContent = areaNames[selectedArea] || "Apartments";
    areaSubtitle.textContent = `Available apartments in ${areaNames[selectedArea] || "this area"}`;
    emptyMessage = "No apartments found for this area yet.";

    filtered = apartments.filter(a => a.areas && a.areas.includes(selectedArea));

  } else {
    return;
  }

  const sorted = currentSort === "default"
    ? sortByAvailability(filtered)
    : sortByPrice(filtered, currentSort);

  apartmentList.innerHTML = sorted.length
    ? renderApartmentCards(sorted)
    : `<p>${emptyMessage}</p>`;

  updatePriceSortUI();
}

function initPriceSortControl() {
  const btn = document.getElementById("price-sort-btn");
  const menu = document.getElementById("price-sort-menu");

  if (!btn || !menu) return;

  function closeMenu() {
    menu.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
  }

  function openMenu() {
    menu.classList.add("open");
    btn.setAttribute("aria-expanded", "true");
  }

  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (menu.classList.contains("open")) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  menu.querySelectorAll(".price-sort-option").forEach(option => {
    option.addEventListener("click", function () {
      currentSort = option.getAttribute("data-sort");

      const url = new URL(window.location.href);
      if (currentSort === "default") {
        url.searchParams.delete("sort");
      } else {
        url.searchParams.set("sort", currentSort);
      }
      window.history.replaceState({}, "", url);

      closeMenu();
      renderAreaPage();
    });
  });

  document.addEventListener("click", function (e) {
    if (!e.target.closest(".filter-bar")) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeMenu();
  });
}

function updatePriceSortUI() {
  const btn = document.getElementById("price-sort-btn");
  const menu = document.getElementById("price-sort-menu");
  if (!btn || !menu) return;

  menu.querySelectorAll(".price-sort-option").forEach(option => {
    const isActive = option.getAttribute("data-sort") === currentSort;
    option.classList.toggle("active", isActive);
    option.setAttribute("aria-checked", isActive ? "true" : "false");
  });

  btn.classList.toggle("is-active", currentSort !== "default");
}

function toggleFAQ() {
  const popup = document.getElementById("faqPopup");
  if (popup) {
    popup.style.display = popup.style.display === "flex" ? "none" : "flex";
  }
}

function closeFAQOutside(event) {
  const popupContent = document.querySelector(".faq-popup-content");
  const popup = document.getElementById("faqPopup");

  if (popupContent && popup && !popupContent.contains(event.target)) {
    popup.style.display = "none";
  }
}

const fadeElements = document.querySelectorAll(".fade-in");

function handleScrollAnimation() {
  fadeElements.forEach(el => {
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight - 100) {
      el.classList.add("visible");
    }
  });
}

window.addEventListener("scroll", handleScrollAnimation);
window.addEventListener("load", handleScrollAnimation);

function toggleMenu() {
  const menu = document.getElementById("floatingMenu");
  if (menu) {
    menu.classList.toggle("open");
  }
}

initPriceSortControl();
renderAreaPage();
loadAvailabilityFromSheet();

function initGlobalSearch() {
  const searchInput = document.getElementById("global-search");
  const suggestionsBox = document.getElementById("search-suggestions");

  if (!searchInput || !suggestionsBox) return;

  function normalizeSearch(value) {
    const raw = value.trim().toUpperCase();

    if (!raw) return "";

    if (/^\d+$/.test(raw)) {
      return `ELN-${raw.padStart(3, "0")}`;
    }

    return raw;
  }

  // Detect if the user is typing a bedroom query like "3 bed", "3 bedroom", "3 bedrooms"
  function parseBedroomQuery(value) {
    const match = value.trim().match(/^(\d)\s*(bed|beds|bedroom|bedrooms)?$/i);
    if (!match) return null;
    // Require at least "X bed" — a bare digit is reserved for code search
    if (!match[2]) return null;
    const num = parseInt(match[1]);
    return (num >= 1 && num <= 5) ? num : null;
  }

  function getMatches(value) {
    const raw = value.trim().toUpperCase();
    const normalized = normalizeSearch(value);
    const bedroomQuery = parseBedroomQuery(value);

    if (!raw) return [];

    return apartments.filter(apartment => {
      const code = (apartment.apartmentCode || "").toUpperCase();
      const numericPart = code.replace("ELN-", "");

      // If the user typed a bedroom query, match on rooms field
      const codeMatch = bedroomQuery !== null || !raw || (
        code.includes(normalized) ||
        code.includes(raw) ||
        numericPart === raw ||
        numericPart === raw.padStart(3, "0")
      );

      const bedroomMatch = bedroomQuery === null || (() => {
        const r = apartment.rooms || "";
        return r.startsWith(bedroomQuery + " bedroom") || r.includes("and " + bedroomQuery + " bedroom") || r.includes(bedroomQuery + " and ");
      })();

      return codeMatch && bedroomMatch;
    }).slice(0, 8);
  }

  function renderSuggestions(matches, bedroomQuery) {
    const hasInput = searchInput.value.trim().length > 0;
    if (!hasInput) {
      suggestionsBox.innerHTML = "";
      suggestionsBox.classList.remove("active");
      return;
    }

    // For bedroom searches, count total matches (not capped)
    const totalBedroomMatches = bedroomQuery !== null
      ? apartments.filter(a => {
          const r = a.rooms || "";
          return r.startsWith(bedroomQuery + " bedroom") || r.includes("and " + bedroomQuery + " bedroom") || r.includes(bedroomQuery + " and ");
        }).length
      : 0;

    if (!matches.length && totalBedroomMatches === 0) {
      suggestionsBox.innerHTML = "";
      suggestionsBox.classList.remove("active");
      return;
    }

    let html = matches.map(apartment => `
      <div class="search-suggestion-item" data-id="${apartment.id}">
        <div class="search-suggestion-code">${apartment.apartmentCode} <span class="search-suggestion-beds">${apartment.rooms}</span></div>
        <div class="search-suggestion-title">${apartment.title}</div>
      </div>
    `).join("");

    if (bedroomQuery !== null && totalBedroomMatches > 0) {
      html += `
        <div class="search-suggestion-item search-view-all" data-beds="${bedroomQuery}">
          View all ${totalBedroomMatches} ${bedroomQuery}-bedroom apartments &rarr;
        </div>
      `;
    }

    suggestionsBox.innerHTML = html;
    suggestionsBox.classList.add("active");

    suggestionsBox.querySelectorAll(".search-suggestion-item[data-id]").forEach(item => {
      item.addEventListener("click", () => {
        const apartmentId = item.getAttribute("data-id");
        window.location.href = `apartment.html?id=${apartmentId}`;
      });
    });

    const viewAllItem = suggestionsBox.querySelector(".search-view-all");
    if (viewAllItem) {
      viewAllItem.addEventListener("click", () => {
        const beds = viewAllItem.getAttribute("data-beds");
        window.location.href = `area.html?beds=${beds}`;
      });
    }
  }

  function updateSuggestions() {
    const bedroomQuery = parseBedroomQuery(searchInput.value);
    const matches = getMatches(searchInput.value);
    renderSuggestions(matches, bedroomQuery);
  }

  searchInput.addEventListener("input", updateSuggestions);

  searchInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      const bedroomQuery = parseBedroomQuery(searchInput.value);
      if (bedroomQuery !== null) {
        window.location.href = `area.html?beds=${bedroomQuery}`;
        return;
      }
      const matches = getMatches(searchInput.value);
      if (matches.length > 0) {
        window.location.href = `apartment.html?id=${matches[0].id}`;
      } else {
        alert("Apartment not found");
      }
    }
  });

  document.addEventListener("click", function (e) {
    if (!e.target.closest(".search-box")) {
      suggestionsBox.classList.remove("active");
    }
  });
}

function initExploreScroll() {
  const rows = document.querySelectorAll(".explore-row");

  rows.forEach(row => {
    const cards = row.querySelectorAll(".explore-card");

    function updateActiveCard() {
      let closestCard = null;
      let closestDistance = Infinity;

      const rowRect = row.getBoundingClientRect();
      const center = rowRect.left + rowRect.width / 2;

      cards.forEach(card => {
        const rect = card.getBoundingClientRect();
        const cardCenter = rect.left + rect.width / 2;
        const distance = Math.abs(center - cardCenter);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestCard = card;
        }
      });

      cards.forEach(card => card.classList.remove("active"));

      if (closestCard) {
        closestCard.classList.add("active");
      }
    }

    row.addEventListener("scroll", updateActiveCard);
    updateActiveCard();
  });
}


document.addEventListener("DOMContentLoaded", function () {
  initGlobalSearch();
  initExploreScroll();

  document.querySelectorAll(".explore-card").forEach(card => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".explore-card").forEach(c => {
        if (c !== card) c.classList.remove("open");
      });
      card.classList.toggle("open");
    });
  });
});
