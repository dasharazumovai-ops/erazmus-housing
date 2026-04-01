async function loadAvailabilityFromSheet() {
  const csvUrl = "https://api.allorigins.win/raw?url=https://docs.google.com/spreadsheets/d/e/2PACX-1vRKk4VqVA_zVfwQ7nuh-_DiX_TBGW9sr68TZrt0QDn052ql8eBw93AgbG8QpIBPSIGSiKqaDD7Jxct2/pub?output=csv";
  try {
    const response = await fetch(csvUrl);
    const csvText = await response.text();

    console.log("CSV text:", csvText);

    const rows = csvText.trim().split("\n").slice(1);

    rows.forEach(row => {
      const columns = row.split(",");

      const sheetCode = columns[0]?.trim().replace(/\r/g, "");
      const availableSpots = columns[1]?.trim().replace(/\r/g, "");
      const totalSpots = columns[2]?.trim().replace(/\r/g, "");

      console.log("Sheet row:", sheetCode, availableSpots, totalSpots);

      const apartment = apartments.find(a => a.apartmentCode?.trim() === sheetCode);

      console.log("Matched apartment:", apartment);

      if (apartment) {
        apartment.availableSpots = Number(availableSpots);
        apartment.totalSpots = Number(totalSpots);
      }
    });

    console.log("Updated apartments:", apartments);
  } catch (error) {
    console.error("Error loading availability from Google Sheets:", error);
  }
}

async function initAreaPage() {
  await loadAvailabilityFromSheet();

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
        if (apartment.availableSpots === apartment.totalSpots) return 0; // fully available
        if (apartment.availableSpots > 0) return 1; // partially available
        return 2; // fully booked
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

initAreaPage();