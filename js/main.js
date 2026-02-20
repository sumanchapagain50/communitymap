// --- MAP & BASELAYERS ---
var osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap'
});
var googleSatLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
  attribution: '© Google Satellite'
});
var map = L.map('map', {
  center: [20, 80],
  zoom: 4,
  layers: [osmLayer]
});
var baseMaps = {
  "OpenStreetMap": osmLayer,
  "Google Satellite": googleSatLayer
};
L.control.layers(baseMaps, null, { collapsed: false, position: 'topright' }).addTo(map);

var countryLayer = L.layerGroup().addTo(map);
var countryLabelLayer = L.layerGroup().addTo(map);
var communityLayer = L.layerGroup();
var communityLabelLayer = L.layerGroup();

// Modal
var modal = document.getElementById("activityModal");
var modalBody = document.getElementById("modalBody");
var closeBtn = modal.querySelector(".close-btn");
closeBtn.addEventListener("click", () => modal.style.display = "none");
modal.addEventListener("click", e => { if (e.target === modal) modal.style.display = "none"; });

// Populate countries
var countrySelect = document.getElementById("countrySelect");
countries.forEach((c, i) => {
  var opt = document.createElement("option");
  opt.value = i;
  opt.textContent = c.name;
  countrySelect.appendChild(opt);
});

// Country markers + labels (PNG from assets/markers/)
countries.forEach(c => {
  const countryNameLower = c.name.toLowerCase().replace(/\s+/g, '-');
  const iconUrl = `assets/markers/${countryNameLower}.png`;

  // Desired height in pixels
  const desiredHeight = 20;

  // Load image to calculate aspect ratio
  const img = new Image();
  img.onload = function() {
    const aspectRatio = img.width / img.height;
    const iconWidth = desiredHeight * aspectRatio;

    const countryIcon = L.icon({
      iconUrl: iconUrl,
      iconSize: [iconWidth, desiredHeight], // width auto-adjusted
      iconAnchor: [iconWidth / 2, desiredHeight], // bottom-center anchor
      popupAnchor: [0, -desiredHeight - 5],
      tooltipAnchor: [0, -desiredHeight]
    });

    const marker = L.marker([c.lat, c.lng], {
      icon: countryIcon,
      title: c.name
    }).addTo(countryLayer);

    // Tooltip
    marker.bindTooltip(c.name, {
      permanent: false,
      direction: "top",
      offset: [0, -10]
    });

    // Optional: country label right side
    const countryLabel = L.marker([c.lat, c.lng], {
      icon: L.divIcon({
        className: 'community-label community-label-right',
        html: `<span>${c.name}</span>`,
        iconSize: [140, 28],
        iconAnchor: [0, 14],
      }),
      interactive: false
    }).addTo(countryLabelLayer);
  };
  img.src = iconUrl;
});
let isFlying = false;
map.on('moveend', function(e) {
  if (!isFlying) return;
  isFlying = false;

  if (countrySelect.value === "") {
    map.addLayer(countryLayer);
    if (document.getElementById("toggleLabels").checked) {
      map.addLayer(countryLabelLayer);
    }
  } else {
    map.addLayer(communityLayer);
    if (document.getElementById("toggleLabels").checked) {
      map.addLayer(communityLabelLayer);
    }
  }
});

// Close popups when switching layers/views
map.on('layerremove', function(e) {
  if (e.layer === communityLayer || e.layer === countryLayer) {
    map.closePopup();
  }
});

// COUNTRY SELECTION
countrySelect.addEventListener("change", function() {
  var idx = this.value;
  if (idx === "") {
    isFlying = true;
    map.removeLayer(communityLayer);
    map.removeLayer(communityLabelLayer);
    document.getElementById("communityTabs").innerHTML = "";
    map.flyTo([20, 80], 4, { duration: 1.5 });

    if (document.getElementById("toggleLabels").checked) {
      map.addLayer(countryLabelLayer);
    }
    return;
  }

  var country = countries[idx];
  map.removeLayer(countryLayer);
  map.removeLayer(countryLabelLayer);
  communityLayer.clearLayers();
  communityLabelLayer.clearLayers();
  document.getElementById("communityTabs").innerHTML = "";

  var bounds = [];
  country.communities.forEach(c => {
    var markerIcon = L.divIcon({
      className: "community-marker",
      html: `
        <div class="outer-circle"></div>
        <div class="inner-dot"></div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -14],
      tooltipAnchor: [0, -10]
    });

    var marker = L.marker([c.lat, c.lng], {
      icon: markerIcon,
      name: c.name
    });

    bounds.push([c.lat, c.lng]);

    // Get hazards as array (supports both single string and array format)
    const hazards = Array.isArray(c.hazards) ? c.hazards : (c.hazard ? [c.hazard] : []);

var popupHTML = `
  <div>
    <div style="display:flex;align-items:center;margin-bottom:8px;">
      <strong>${c.name}</strong>
    </div>

    <!-- Hazard icons row – hover shows capitalized name -->
    <div style="display:flex; gap:8px; margin-bottom:10px; flex-wrap:wrap;">
      ${hazards.map(hazard => {
        const hazardName = hazard.toLowerCase();
        const displayName = hazard.charAt(0).toUpperCase() + hazard.slice(1).toLowerCase();
        return `<img src="assets/markers/${hazardName}.png" 
                     style="width:24px; height:24px; object-fit:contain; cursor:help;" 
                     title="${displayName}" 
                     alt="${displayName} hazard">`;
      }).join('')}
      ${hazards.length === 0 ? '<span style="color:#777; font-size:12px;">No hazards recorded</span>' : ''}
    </div>

    <div class="tabs">
      <div class="tab active" data-tab="demographic">Demographics</div>
      <div class="tab" data-tab="scores">Scores</div>
    </div>

    <div class="tab-content active" id="demographic">
      ${Object.entries(c.demographic || {}).map(([key, value]) => `
        <div style="margin-bottom:6px;">
          <strong style="text-transform:capitalize;">${key.replace(/([A-Z])/g, ' $1')}:</strong> ${value}
        </div>
      `).join('')}
      ${Object.keys(c.demographic || {}).length === 0 ? '<em>No demographic data available</em>' : ''}
    </div>

    <div class="tab-content" id="scores">
      <div>Resilience:</div>
      <div style="background:#ddd;width:100%;height:15px;border-radius:5px;margin-top:3px;">
        <div style="width:${c.scores.resilience}%;background:#4CAF50;height:15px;border-radius:5px;"></div>
      </div>
      <div style="font-size:12px;margin-top:2px;">${c.scores.resilience}%</div>
    </div>

    <button class="view-activities-btn" style="margin-top:12px;padding:6px 12px;">View Activities</button>
  </div>
`;

    marker.bindPopup(popupHTML, {
      autoPan: true,
      autoPanPadding: [20, 20],
      closeButton: true,
      minWidth: 280
    });

    marker.on('popupopen', function(e) {
      const popupElement = e.popup.getElement();
      if (!popupElement) return;

      const tabs = popupElement.querySelectorAll(".tab");
      const contents = popupElement.querySelectorAll(".tab-content");

      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          tabs.forEach(t => t.classList.remove('active'));
          contents.forEach(c => c.classList.remove('active'));
          tab.classList.add('active');
          popupElement.querySelector("#" + tab.dataset.tab).classList.add('active');
        });
      });

      const btn = popupElement.querySelector(".view-activities-btn");
      if (btn) {
        btn.addEventListener("click", () => {
          modalBody.innerHTML = `<h3>Activities for ${c.name}</h3>` +
            c.activities.map(a => `
              <div class="activity-detail">
                <img src="assets/photos/${a.photo}" />
                <div><strong>${a.title}</strong><br>${a.details}</div>
              </div>
            `).join('');
          modal.style.display = "flex";
        });
      }
    });

    marker.addTo(communityLayer);

    var label = L.marker([c.lat, c.lng], {
      icon: L.divIcon({
        className: 'community-label community-label-right',
        html: `<span>${c.name}</span>`,
        iconSize: [140, 28],
        iconAnchor: [0, 14],
      }),
      interactive: false
    }).addTo(communityLabelLayer);

    var tab = document.createElement("div");
    tab.className = "community-tab";
    tab.textContent = c.name;
    tab.style.cursor = "pointer";
    tab.style.padding = "4px 6px";
    tab.style.borderBottom = "1px solid #ccc";

    tab.addEventListener("click", function() {
      document.querySelectorAll('.community-tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      this.scrollIntoView({ behavior: "smooth", block: "nearest" });

      const el = marker.getElement();
      if (el) {
        el.classList.add('grayscale-highlight');
        setTimeout(() => el.classList.remove('grayscale-highlight'), 1500);
      }

      map.closePopup();
      marker.openPopup();
    });

    document.getElementById("communityTabs").appendChild(tab);
  });

  if (bounds.length > 0) {
    const groupBounds = L.latLngBounds(bounds);
    isFlying = true;
    map.flyToBounds(groupBounds, { padding: [60, 60], duration: 1.8, easeLinearity: 0.25 });
  } else {
    isFlying = true;
    map.flyTo([country.lat, country.lng], 8);
  }

  if (document.getElementById("toggleLabels").checked) {
    map.addLayer(communityLabelLayer);
  }

  suggestionsList.innerHTML = "";
  suggestionsList.style.display = "none";
});

// Toggle labels (context-aware)
var labelToggle = document.getElementById("toggleLabels");
labelToggle.checked = true;
labelToggle.addEventListener("change", function() {
  const isGlobal = countrySelect.value === "";

  if (this.checked) {
    if (isGlobal) {
      map.addLayer(countryLabelLayer);
      map.removeLayer(communityLabelLayer);
    } else {
      map.addLayer(communityLabelLayer);
      map.removeLayer(countryLabelLayer);
    }

    const activeLayer = isGlobal ? countryLayer : communityLayer;
    activeLayer.eachLayer(layer => {
      if (layer instanceof L.Marker) layer.unbindTooltip();
    });
  } else {
    if (isGlobal) {
      map.removeLayer(countryLabelLayer);
    } else {
      map.removeLayer(communityLabelLayer);
    }

    const activeLayer = isGlobal ? countryLayer : communityLayer;
    activeLayer.eachLayer(layer => {
      if (layer instanceof L.Marker && !layer.getTooltip()) {
        layer.bindTooltip(layer.options.title || layer.options.name || "?", {
          permanent: false,
          direction: "top",
          className: "temp-hover-tooltip"
        });
      }
    });
  }
});

// ────────────────────────────────────────────────
// Community search with context-aware autocomplete + search button
// ────────────────────────────────────────────────
const communitySearch = document.getElementById("communitySearch");
const suggestionsList = document.getElementById("suggestionsList");
const searchBtn = document.getElementById("searchBtn");

function getContextCommunities() {
  const selectedIdx = countrySelect.value;
  if (selectedIdx === "") {
    return countries.flatMap((country, countryIdx) =>
      country.communities.map(comm => ({
        ...comm,
        countryName: country.name,
        countryIndex: countryIdx
      }))
    );
  } else {
    const country = countries[selectedIdx];
    return country.communities.map(comm => ({
      ...comm,
      countryName: country.name,
      countryIndex: parseInt(selectedIdx)
    }));
  }
}

function activateCommunityTab(communityName) {
  const tab = Array.from(document.querySelectorAll(".community-tab"))
    .find(t => t.textContent === communityName);
  if (tab) {
    document.querySelectorAll('.community-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    tab.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

communitySearch.addEventListener("input", function() {
  const searchTerm = this.value.toLowerCase().trim();
  suggestionsList.innerHTML = "";
  if (searchTerm === "") {
    suggestionsList.style.display = "none";
    if (countrySelect.value !== "") filterTabs("");
    return;
  }
  const currentCommunities = getContextCommunities();
  const matches = currentCommunities.filter(c =>
    c.name.toLowerCase().includes(searchTerm)
  );
  if (matches.length === 0) {
    suggestionsList.style.display = "none";
    return;
  }
  matches.forEach(comm => {
    const li = document.createElement("li");
    li.textContent = countrySelect.value === "" ? `${comm.name} (${comm.countryName})` : comm.name;
    li.dataset.name = comm.name;
    li.dataset.countryIndex = comm.countryIndex;
    li.addEventListener("click", () => {
      communitySearch.value = comm.name;
      suggestionsList.style.display = "none";
      const targetIdx = comm.countryIndex.toString();
      if (countrySelect.value !== targetIdx) {
        countrySelect.value = targetIdx;
        countrySelect.dispatchEvent(new Event("change"));
        setTimeout(() => activateCommunityTab(comm.name), 1200);
      } else {
        activateCommunityTab(comm.name);
      }
    });
    li.addEventListener("mouseover", () => {
      suggestionsList.querySelectorAll("li").forEach(l => l.classList.remove("active"));
      li.classList.add("active");
    });
    suggestionsList.appendChild(li);
  });
  suggestionsList.style.display = "block";
});

function filterTabs(searchTerm) {
  if (countrySelect.value === "") return;
  const term = searchTerm.toLowerCase().trim();
  document.querySelectorAll(".community-tab").forEach(tab => {
    tab.classList.toggle("hidden", term !== "" && !tab.textContent.toLowerCase().includes(term));
  });
}

searchBtn.addEventListener("click", function() {
  const term = communitySearch.value.trim();
  if (term === "") return;
  if (suggestionsList.style.display === "block" && suggestionsList.children.length > 0) {
    const active = suggestionsList.querySelector("li.active");
    if (active) {
      active.click();
    } else {
      suggestionsList.querySelector("li").click();
    }
  } else if (countrySelect.value !== "") {
    filterTabs(term);
    const firstVisible = document.querySelector(".community-tab:not(.hidden)");
    if (firstVisible) {
      document.querySelectorAll('.community-tab').forEach(t => t.classList.remove('active'));
      firstVisible.classList.add('active');
      firstVisible.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }
  suggestionsList.style.display = "none";
});

// Close suggestions
document.addEventListener("click", e => {
  if (!communitySearch.contains(e.target) && !suggestionsList.contains(e.target) && e.target !== searchBtn) {
    suggestionsList.style.display = "none";
  }
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    suggestionsList.style.display = "none";
    communitySearch.blur();
  }
});
communitySearch.addEventListener("blur", () => {
  setTimeout(() => {
    if (!suggestionsList.matches(":hover")) suggestionsList.style.display = "none";
  }, 150);
});
communitySearch.addEventListener("keydown", e => {
  if (suggestionsList.style.display !== "block") return;
  const items = suggestionsList.querySelectorAll("li");
  if (items.length === 0) return;
  let active = suggestionsList.querySelector("li.active");
  let idx = active ? Array.from(items).indexOf(active) : -1;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    idx = (idx + 1) % items.length;
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    idx = (idx - 1 + items.length) % items.length;
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (active) {
      active.click();
    } else if (items.length > 0) {
      items[0].click();
    }
    return;
  } else return;
  items.forEach(li => li.classList.remove("active"));
  items[idx].classList.add("active");
  items[idx].scrollIntoView({ block: "nearest" });
});

// ────────────────────────────────────────────────
// Sidebar toggle logic
// ────────────────────────────────────────────────
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebarClose = document.getElementById("sidebarClose");

function toggleSidebar() {
  if (window.innerWidth <= 768) {
    sidebar.classList.toggle("active");
  } else {
    sidebar.classList.toggle("hidden");
  }
}

sidebarToggle.addEventListener("click", toggleSidebar);
sidebarClose.addEventListener("click", toggleSidebar);

map.on("click", () => {
  if (window.innerWidth <= 768) sidebar.classList.remove("active");
});

if (window.innerWidth > 768) {
  sidebar.classList.remove("hidden");
} else {
  sidebar.classList.remove("active");
}

window.addEventListener("resize", () => {
  if (window.innerWidth > 768) {
    sidebar.classList.remove("hidden");
  } else {
    sidebar.classList.remove("active");
  }
});