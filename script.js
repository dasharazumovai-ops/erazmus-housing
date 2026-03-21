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

  const filteredApartments = apartments.filter(apartment => apartment.area === selectedArea);
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