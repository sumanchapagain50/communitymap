// js/map.js

const CATEGORY_ICONS = {
    health:    'markers/health.svg',
    education: 'markers/education.svg',
    business:  'markers/business.svg'
    // add more categories here when needed
};

const map = L.map('map', {
    zoomControl: true,
    attributionControl: true
}).setView([28.9275, 80.22], 15);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Store layer groups per community
const communityLayers = {};
let currentCommunityId = null;

function createMarkerIcon(feature) {
    const iconUrl = CATEGORY_ICONS[feature.category] || CATEGORY_ICONS.health;
    const catCap = feature.category.charAt(0).toUpperCase() + feature.category.slice(1);

    return L.divIcon({
        className: 'custom-marker',
        html: `
            <div style="text-align:center;">
                <img src="${iconUrl}" class="custom-svg-icon" alt="${feature.category}">
                <div class="plain-label" style="display:none;">
                    ${feature.name}
                </div>
            </div>
        `,
        iconSize: [48, 64],       // adjusted for longer names
        iconAnchor: [24, 58],     // center bottom
        popupAnchor: [0, -50]
    });
}

function loadCommunity(communityId) {
    // Clean up previous layers
    Object.values(communityLayers).forEach(groups => {
        Object.values(groups).forEach(layer => map.removeLayer(layer));
    });

    const community = COMMUNITIES.find(c => c.id === communityId);
    if (!community) return;

    currentCommunityId = communityId;

    const layers = {
        health:    L.layerGroup().addTo(map),
        education: L.layerGroup().addTo(map),
        business:  L.layerGroup().addTo(map)
    };
    communityLayers[communityId] = layers;

    community.features.forEach(feature => {
        if (typeof feature.lat !== 'number' || typeof feature.lng !== 'number') return;

        const icon = createMarkerIcon(feature);
        const marker = L.marker([feature.lat, feature.lng], { icon });

        const catCap = feature.category.charAt(0).toUpperCase() + feature.category.slice(1);
        const popupContent = `
            <b>${feature.name}</b><br>
            <span style="color:#555;">${catCap}</span><hr>
            <i>${feature.details || 'No details available.'}</i>
        `;
        marker.bindPopup(popupContent, { maxWidth: 280 });

        // Hover tooltip: name + category
        marker.bindTooltip(
            `${feature.name}<br><small style="opacity:0.8;">${catCap}</small>`,
            {
                direction: 'top',
                offset: [0, -14],
                opacity: 0.92,
                className: 'marker-tooltip'
            }
        );

        const group = layers[feature.category];
        if (group) group.addLayer(marker);
    });

    map.flyTo(community.center, community.zoom, {
        animate: true,
        duration: 1.2
    });

    document.getElementById('community-title').textContent = community.name;

    // Reset labels to hidden
    document.getElementById('toggle-labels').checked = false;
    updateLabelVisibility(false);
}

function updateLabelVisibility(show) {
    document.querySelectorAll('.custom-marker .plain-label').forEach(label => {
        label.style.display = show ? 'block' : 'none';
    });
}

function getCurrentLayers() {
    return communityLayers[currentCommunityId] || {};
}

// ────────────────────────────────────────────────
// Custom Control
// ────────────────────────────────────────────────

const control = L.control({ position: 'topleft' });

control.onAdd = function () {
    const div = L.DomUtil.create('div', 'custom-control');

    let options = '<option value="">-- Select Community --</option>';
    COMMUNITIES.forEach(c => {
        options += `<option value="${c.id}">${c.name}</option>`;
    });

    div.innerHTML = `
        <select id="community-select">${options}</select>
        <h3 id="community-title">${COMMUNITIES[0]?.name || 'Select a community'}</h3>

        <div class="category-item">
            <label><input type="checkbox" id="toggle-health" checked>
                <img src="${CATEGORY_ICONS.health}" class="legend-icon" alt=""> Health</label>
        </div>
        <div class="category-item">
            <label><input type="checkbox" id="toggle-education" checked>
                <img src="${CATEGORY_ICONS.education}" class="legend-icon" alt=""> Education</label>
        </div>
        <div class="category-item">
            <label><input type="checkbox" id="toggle-business" checked>
                <img src="${CATEGORY_ICONS.business}" class="legend-icon" alt=""> Business</label>
        </div>

        <hr style="margin: 12px 0;">
        <div class="category-item">
            <label><input type="checkbox" id="toggle-labels"> Show permanent name labels</label>
        </div>

        <hr style="margin: 12px 0;">
        <button id="recenter-btn" class="recenter-btn">Re-center Map</button>

        <hr style="margin: 12px 0;">
        <small style="color:#666;">Click = details • Hover = name + category</small>
    `;

    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);
    return div;
};

control.addTo(map);

// ────────────────────────────────────────────────
// Event Listeners
// ────────────────────────────────────────────────

document.getElementById('community-select').addEventListener('change', e => {
    const id = e.target.value;
    if (id) loadCommunity(id);
});

document.getElementById('toggle-health').addEventListener('change', e => {
    const layers = getCurrentLayers();
    if (layers.health) {
        e.target.checked ? layers.health.addTo(map) : map.removeLayer(layers.health);
    }
});

document.getElementById('toggle-education').addEventListener('change', e => {
    const layers = getCurrentLayers();
    if (layers.education) {
        e.target.checked ? layers.education.addTo(map) : map.removeLayer(layers.education);
    }
});

document.getElementById('toggle-business').addEventListener('change', e => {
    const layers = getCurrentLayers();
    if (layers.business) {
        e.target.checked ? layers.business.addTo(map) : map.removeLayer(layers.business);
    }
});

document.getElementById('toggle-labels').addEventListener('change', e => {
    updateLabelVisibility(e.target.checked);
});

document.getElementById('recenter-btn').addEventListener('click', () => {
    const community = COMMUNITIES.find(c => c.id === currentCommunityId);
    if (community) {
        map.flyTo(community.center, community.zoom, {
            animate: true,
            duration: 1.5
        });
    }
});

// ────────────────────────────────────────────────
// Initial Load
// ────────────────────────────────────────────────

if (COMMUNITIES.length > 0) {
    document.getElementById('community-select').value = COMMUNITIES[0].id;
    loadCommunity(COMMUNITIES[0].id);
}