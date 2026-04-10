async function loadAvailabilityFromSheet() {
  const csvUrl = "https://api.allorigins.win/raw?url=https://docs.google.com/spreadsheets/d/e/2PACX-1vRKk4VqVA_zVfwQ7nuh-_DiX_TBGW9sr68TZrt0QDn052ql8eBw93AgbG8QpIBPSIGSiKqaDD7Jxct2/pub?output=csv";

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
function applyAvailabilityData(csvText) {
  const rows = csvText.trim().split("\n").slice(1);

  rows.forEach(row => {
    const [id, availableSpots, totalSpots] = row.split(",");

    const apartment = apartments.find(a => a.apartmentCode === id.trim());

    if (apartment) {
      apartment.availableSpots = Number(availableSpots);
      apartment.totalSpots = Number(totalSpots);
    }
  });
}

function renderAreaPage() {
  const params = new URLSearchParams(window.location.search);
  const selectedArea = params.get("area");

  const areaTitle = document.getElementById("area-title");
  const areaSubtitle = document.getElementById("area-subtitle");
  const apartmentList = document.getElementById("apartment-list");

  if (selectedArea && areaTitle && apartmentList) {
    const areaNames = {
      centre: "City Centre",
      engomi: "Engomi",
      aglantzia: "Aglantzia"
    };

    areaTitle.textContent = areaNames[selectedArea] || "Apartments";
    areaSubtitle.textContent = `Available apartments in ${areaNames[selectedArea] || "this area"}`;

    const filteredApartments = apartments.filter(apartment =>
      apartment.areas && apartment.areas.includes(selectedArea)
    );

    filteredApartments.sort((a, b) => {
      const getAvailabilityRank = (apartment) => {
        if (apartment.availableSpots === apartment.totalSpots) return 0;
        if (apartment.availableSpots > 0) return 1;
        return 2;
      };

      return getAvailabilityRank(a) - getAvailabilityRank(b);
    });

    if (filteredApartments.length === 0) {
      apartmentList.innerHTML = "<p>No apartments found for this area yet.</p>";
    } else {
      apartmentList.innerHTML = filteredApartments.map(apartment => `
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
  }
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

  function getMatches(value) {
    const raw = value.trim().toUpperCase();
    const normalized = normalizeSearch(value);

    if (!raw) return [];

    return apartments.filter(apartment => {
      const code = (apartment.apartmentCode || "").toUpperCase();
      const numericPart = code.replace("ELN-", "");

      return (
        code.includes(normalized) ||
        code.includes(raw) ||
        numericPart === raw ||
        numericPart === raw.padStart(3, "0")
      );
    }).slice(0, 5);
  }

  function renderSuggestions(matches) {
    if (!matches.length) {
      suggestionsBox.innerHTML = "";
      suggestionsBox.classList.remove("active");
      return;
    }

    suggestionsBox.innerHTML = matches.map(apartment => `
      <div class="search-suggestion-item" data-id="${apartment.id}">
        <div class="search-suggestion-code">${apartment.apartmentCode}</div>
        <div class="search-suggestion-title">${apartment.title}</div>
      </div>
    `).join("");

    suggestionsBox.classList.add("active");

    suggestionsBox.querySelectorAll(".search-suggestion-item").forEach(item => {
      item.addEventListener("click", () => {
        const apartmentId = item.getAttribute("data-id");
        window.location.href = `apartment.html?id=${apartmentId}`;
      });
    });
  }

  searchInput.addEventListener("input", function () {
    const matches = getMatches(searchInput.value);
    renderSuggestions(matches);
  });

  searchInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
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
  initExploreFade();

document.querySelectorAll(".explore-card").forEach(card => {
  card.addEventListener("click", () => {
    document.querySelectorAll(".explore-card").forEach(c => {
      if (c !== card) c.classList.remove("open");
    });
    card.classList.toggle("open");
  });
});

});
