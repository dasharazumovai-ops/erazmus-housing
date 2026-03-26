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
  if (a.availableSpots === 0 && b.availableSpots > 0) return 1;
  if (a.availableSpots > 0 && b.availableSpots === 0) return -1;
  return 0; // keep original order
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
function toggleFAQ() {
  const popup = document.getElementById("faqPopup");
  popup.style.display = popup.style.display === "flex" ? "none" : "flex";
}

function closeFAQOutside(event) {
  const popupContent = document.querySelector(".faq-popup-content");
  if (!popupContent.contains(event.target)) {
    document.getElementById("faqPopup").style.display = "none";
  }
}
const fadeElements = document.querySelectorAll('.fade-in');

function handleScrollAnimation() {
  fadeElements.forEach(el => {
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight - 100) {
      el.classList.add('visible');
    }
  });
}

window.addEventListener('scroll', handleScrollAnimation);
window.addEventListener('load', handleScrollAnimation);

function toggleMenu() {
  const menu = document.getElementById("floatingMenu");
  if (menu) {
    menu.classList.toggle("open");
  }
}