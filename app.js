// State & Persistence
let isAdmin = false;
let currentUserRole = null;

// Load saved data
const savedCommunities = JSON.parse(localStorage.getItem('added_communities_v2') || '[]');
const savedActivities = JSON.parse(localStorage.getItem('added_activities_v2') || '[]');
const archivedCommunityIds = JSON.parse(localStorage.getItem('archived_communities_v2') || '[]');
const archivedActivityIds = JSON.parse(localStorage.getItem('archived_activities_v2') || '[]');

// Build Data Lists (excluding archived items)
let communitiesData = [...communities, ...savedCommunities].filter(c => !archivedCommunityIds.includes(c.id));
let activitiesData = [...activities, ...savedActivities].filter(a => !archivedActivityIds.includes(a.id));

// Knowledge Hub State
let externalKnowledgeLinks = JSON.parse(localStorage.getItem('crmc_external_knowledge') || '[]');

// User Management State
const defaultUsers = [{ name: 'admin', pass: 'Suchana@2022', role: 'KRO' }];
let usersData = JSON.parse(localStorage.getItem('crmc_users') || JSON.stringify(defaultUsers));

// Indicator Management State
let indicatorsData;
const storedInds = localStorage.getItem('crmc_indicators_v4');
if (storedInds) {
    indicatorsData = JSON.parse(storedInds);
} else {
    // Initial load: deep clone from staticData.indicators
    indicatorsData = JSON.parse(JSON.stringify(staticData.indicators));
    localStorage.setItem('crmc_indicators_v4', JSON.stringify(indicatorsData));
}

// Map Initialization
const map = L.map('map', {
    zoomControl: true
}).setView([27.1, 80.8], 10);

const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EBP, and the GIS User Community'
});

const baseLayers = {
    "OpenStreetMap": osm,
    "Satellite": satellite
};

L.control.layers(baseLayers, null, { position: 'topleft' }).addTo(map);

// Sidebar Elements
const sidebar = document.getElementById('sidebar');
const showBtn = document.getElementById('show-sidebar-btn');
const hideBtn = document.getElementById('toggle-sidebar');
const openCompareBtn = document.getElementById('open-compare-btn');
const exitCompareBtn = document.getElementById('exit-compare-btn');
const colCompare = document.getElementById('col-compare');
const compareSelect = document.getElementById('compare-community-select-v2');

// Admin Elements
const loginBtn = document.getElementById('admin-login-btn');
const logoutBtn = document.getElementById('admin-logout-btn');
const manageActivitiesBtn = document.getElementById('manage-activities-btn');
const archivedCommunitiesBtn = document.getElementById('archived-communities-btn');
const loginModal = document.getElementById('login-modal');
const addCommModal = document.getElementById('add-community-modal');
const manageActModal = document.getElementById('manage-activities-modal');
const manageUsersModal = document.getElementById('manage-users-modal');
const manageIndModal = document.getElementById('manage-indicators-modal');
const archiveModal = document.getElementById('archive-modal');
const adminNameInput = document.getElementById('admin-username'); // Note: added in HTML previously or need to check
const adminPasswordInput = document.getElementById('admin-password');
const loginError = document.getElementById('login-error');
const manageUsersBtn = document.getElementById('manage-users-btn');
const manageIndBtn = document.getElementById('manage-indicators-btn');
const manageCommunitiesBtn = document.getElementById('manage-communities-btn');
const manageKnowledgeBtn = document.getElementById('manage-knowledge-btn');
const manageCommModal = document.getElementById('manage-communities-modal');
const manageKnowledgeModal = document.getElementById('manage-knowledge-modal');

// Admin Login Logic
loginBtn.addEventListener('click', () => {
    loginModal.classList.remove('hidden');
    adminPasswordInput.value = '';
    loginError.classList.add('hidden');
});

document.getElementById('login-cancel').addEventListener('click', () => {
    loginModal.classList.add('hidden');
});

document.getElementById('login-submit').addEventListener('click', () => {
    const enteredUser = document.getElementById('admin-username').value.trim();
    const enteredPass = adminPasswordInput.value;
    
    const user = usersData.find(u => u.name === enteredUser && u.pass === enteredPass);

    if (user) {
        isAdmin = true;
        currentUserRole = user.role;
        loginBtn.classList.add('hidden');
        logoutBtn.classList.remove('hidden');
        manageActivitiesBtn.classList.remove('hidden');
        archivedCommunitiesBtn.classList.remove('hidden');
        
        // Role-Based Visibility
        if (currentUserRole === 'KRO') {
            manageUsersBtn.classList.remove('hidden');
            manageIndBtn.classList.remove('hidden');
            manageCommunitiesBtn.classList.remove('hidden');
            manageKnowledgeBtn.classList.remove('hidden');
            archivedCommunitiesBtn.classList.remove('hidden');
            document.getElementById('kro-dashboard-btn').classList.remove('hidden');
        } else {
            manageUsersBtn.classList.add('hidden');
            manageIndBtn.classList.add('hidden');
            manageCommunitiesBtn.classList.add('hidden');
            archivedCommunitiesBtn.classList.add('hidden');
            document.getElementById('kro-dashboard-btn').classList.add('hidden');
        }

        loginModal.classList.add('hidden');
        document.body.classList.add('admin-mode-active');

        // Add Admin Badge
        const badge = document.createElement('div');
        badge.id = 'admin-badge';
        badge.className = 'admin-badge';
        badge.innerText = `Admin Mode: ${user.name} (${user.role})`;
        document.body.appendChild(badge);
    } else {
        loginError.classList.remove('hidden');
    }
});

logoutBtn.addEventListener('click', () => {
    isAdmin = false;
    currentUserRole = null;
    loginBtn.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
    manageActivitiesBtn.classList.add('hidden');
    manageUsersBtn.classList.add('hidden');
    manageIndBtn.classList.add('hidden');
    manageCommunitiesBtn.classList.add('hidden');
    manageKnowledgeBtn.classList.add('hidden');
    archivedCommunitiesBtn.classList.add('hidden');
    document.getElementById('kro-dashboard-btn').classList.add('hidden');
    document.body.classList.remove('admin-mode-active');
    const badge = document.getElementById('admin-badge');
    if (badge) badge.remove();
    // Re-render current community without edit button
    renderColumn(null, 'main');
});

// Map Click for Admin (KRO ONLY)
map.on('click', (e) => {
    if (!isAdmin || currentUserRole !== 'KRO') return;
    const { lat, lng } = e.latlng;
    openAddCommunityForm(lat, lng);
});

function openAddCommunityForm(lat, lng) {
    resetAddCommunityForm();
    document.getElementById('community-modal-title').innerText = 'Add New Community';
    document.getElementById('edit-comm-id').value = '';
    document.getElementById('delete-comm-btn').classList.add('hidden');
    addCommModal.classList.remove('hidden');
    document.getElementById('new-comm-coords').value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

function openEditCommunityForm(community) {
    resetAddCommunityForm();
    document.getElementById('community-modal-title').innerText = 'Edit Community';
    document.getElementById('edit-comm-id').value = community.id;
    document.getElementById('delete-comm-btn').classList.remove('hidden');
    addCommModal.classList.remove('hidden');

    // Pre-fill Basics
    document.getElementById('new-comm-name').value = community.name;
    document.getElementById('new-comm-country').value = community.country;
    document.getElementById('new-comm-coords').value = community.coords.join(', ');

    // Pre-fill Demographics
    const d = community.demographics;
    document.getElementById('new-demo-total').value = d.total;
    document.getElementById('new-demo-male').value = d.male;
    document.getElementById('new-demo-female').value = d.female;
    document.getElementById('new-demo-children').value = d.children;
    document.getElementById('new-demo-elderly').value = d.elderly;
    document.getElementById('new-demo-disabilities').value = d.disabilities;
    document.getElementById('new-demo-desc').value = d.description || '';

    // Pre-fill Resilience
    document.getElementById('new-score-t0').value = community.t0_score;
    document.getElementById('new-score-t1').value = community.t1_score;

    // Pre-fill Gradings
    if (community.gradings) {
        Object.entries(community.gradings).forEach(([indId, grades]) => {
            const t0sel = document.querySelector(`.grading-input[data-indicator="${indId}"][data-type="t0"]`);
            const t1sel = document.querySelector(`.grading-input[data-indicator="${indId}"][data-type="t1"]`);
            if (t0sel) t0sel.value = grades.t0;
            if (t1sel) t1sel.value = grades.t1;
        });
    }

    // Pre-check Activities
    activitiesData.forEach(act => {
        const cb = document.getElementById(`actcb_${act.id}`);
        if (cb) cb.checked = act.communityIds.includes(community.id);
    });
}

function resetAddCommunityForm() {
    document.getElementById('add-community-form').reset();
    showFormSection('basics');

    // Populate Gradings Grid
    const grid = document.getElementById('gradings-grid');
    grid.innerHTML = '';
    staticData.capitals.forEach(cap => {
        const inds = indicatorsData[cap.id] || [];
        inds.forEach(ind => {
            const div = document.createElement('div');
            div.className = 'form-group';
            div.innerHTML = `
                <label style="color: ${cap.color}">${ind.name}</label>
                <div style="display: flex; gap: 5px;">
                    <input type="number" class="grading-input" data-indicator="${ind.id}" data-type="t0" min="1" max="100" value="0" placeholder="T0 (1-100)">
                    <input type="number" class="grading-input" data-indicator="${ind.id}" data-type="t1" min="1" max="100" value="0" placeholder="T1 (1-100)">
                </div>
            `;
            grid.appendChild(div);
        });
    });

    // Populate Activity Checklist for the community form
    const checklistEl = document.getElementById('activity-checklist');
    if (checklistEl) {
        checklistEl.innerHTML = '';
        activitiesData.forEach(act => {
            const label = document.createElement('label');
            label.className = 'check-label';
            const timeInfo = (act.year && act.quarter) ? ` (${act.year}-Q${act.quarter})` : '';
            label.innerHTML = `<input type="checkbox" id="actcb_${act.id}" value="${act.id}"> ${act.name}${timeInfo}`;
            checklistEl.appendChild(label);
        });
    }

    // Populate Inline Indicator Checklist
    const indList = document.getElementById('inline-indicator-checklist');
    if (indList) {
        indList.innerHTML = '';
        staticData.capitals.forEach(cap => {
            const inds = indicatorsData[cap.id] || [];
            inds.forEach(ind => {
                const label = document.createElement('label');
                label.className = 'check-label';
                label.innerHTML = `<input type="checkbox" class="inline-ind-cb" value="${ind.id}"> <span style="color:${cap.color}">${cap.name}: ${ind.name}</span>`;
                indList.appendChild(label);
            });
        });
    }
}

// Form Tab Switching
document.querySelectorAll('.form-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        showFormSection(btn.dataset.formTab);
    });
});

function showFormSection(sectionId) {
    document.querySelectorAll('.form-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.formTab === sectionId));
    document.querySelectorAll('.form-section').forEach(s => s.classList.toggle('hidden', s.id !== `form-${sectionId}`));
}

document.getElementById('add-comm-cancel').addEventListener('click', () => {
    addCommModal.classList.add('hidden');
});

document.getElementById('delete-comm-btn').addEventListener('click', () => {
    const editId = document.getElementById('edit-comm-id').value;
    if (!editId) return;
    
    if (!confirm('Are you sure you want to delete this community? It will be moved to the Archive.')) return;
    
    if (!archivedCommunityIds.includes(editId)) {
        archivedCommunityIds.push(editId);
        localStorage.setItem('archived_communities_v2', JSON.stringify(archivedCommunityIds));
    }
    
    communitiesData = communitiesData.filter(c => c.id !== editId);
    
    addCommModal.classList.add('hidden');
    renderMarkers(document.getElementById('country-select').value);
    populateCompareDropdown();
    renderColumn(null, 'main');
    sidebar.classList.remove('hidden');
    showBtn.classList.add('hidden');
    alert('Community moved to Archive.');
});

document.getElementById('add-comm-submit').addEventListener('click', () => {
    const name = document.getElementById('new-comm-name').value.trim();
    if (!name) return alert('Please enter a community name.');

    const coordsStr = document.getElementById('new-comm-coords').value.trim();
    if (!coordsStr) return alert('Please set coordinates (click map or type manually).');
    const parts = coordsStr.split(',');
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    if (isNaN(lat) || isNaN(lng)) return alert('Invalid coordinates. Use format: lat, lng');

    const gradings = {};
    document.querySelectorAll('.grading-input').forEach(sel => {
        const indId = sel.dataset.indicator;
        const type = sel.dataset.type;
        if (!gradings[indId]) gradings[indId] = {};
        gradings[indId][type] = parseInt(sel.value) || 0;
    });

    // Collect selected activity IDs
    const selectedActIds = [];
    document.querySelectorAll('#activity-checklist input[type="checkbox"]:checked').forEach(cb => {
        selectedActIds.push(cb.value);
    });

    const editId = document.getElementById('edit-comm-id').value;
    const isEdit = editId !== '';

    const commData = {
        id: isEdit ? editId : 'comm_' + Date.now(),
        name: name,
        country: document.getElementById('new-comm-country').value,
        coords: [lat, lng],
        t0_score: parseInt(document.getElementById('new-score-t0').value) || 0,
        t1_score: parseInt(document.getElementById('new-score-t1').value) || 0,
        demographics: {
            total: parseInt(document.getElementById('new-demo-total').value) || 0,
            male: parseInt(document.getElementById('new-demo-male').value) || 0,
            female: parseInt(document.getElementById('new-demo-female').value) || 0,
            children: parseInt(document.getElementById('new-demo-children').value) || 0,
            elderly: parseInt(document.getElementById('new-demo-elderly').value) || 0,
            disabilities: parseInt(document.getElementById('new-demo-disabilities').value) || 0,
            description: document.getElementById('new-demo-desc').value
        },
        gradings: gradings
    };

    if (isEdit) {
        const idx = communitiesData.findIndex(c => c.id === editId);
        if (idx !== -1) communitiesData[idx] = commData;
        const savedList = JSON.parse(localStorage.getItem('added_communities_v2') || '[]');
        const savedIdx = savedList.findIndex(c => c.id === editId);
        if (savedIdx !== -1) savedList[savedIdx] = commData;
        else savedList.push(commData);
        localStorage.setItem('added_communities_v2', JSON.stringify(savedList));
    } else {
        communitiesData.push(commData);
        const savedList = JSON.parse(localStorage.getItem('added_communities_v2') || '[]');
        savedList.push(commData);
        localStorage.setItem('added_communities_v2', JSON.stringify(savedList));
    }

    // Update activity assignments based on checklist
    activitiesData.forEach(act => {
        if (selectedActIds.includes(act.id)) {
            if (!act.communityIds.includes(commData.id)) act.communityIds.push(commData.id);
        } else {
            act.communityIds = act.communityIds.filter(id => id !== commData.id);
        }
    });
    saveActivitiesToStorage();

    addCommModal.classList.add('hidden');
    renderMarkers(document.getElementById('country-select').value);
    populateCompareDropdown();
    renderColumn(commData, 'main');
    sidebar.classList.remove('hidden');
    showBtn.classList.add('hidden');
    alert(isEdit ? 'Community updated!' : 'Community added!');
});

// Comparison Toggle
openCompareBtn.addEventListener('click', () => {
    sidebar.classList.add('expanded');
    colCompare.classList.remove('hidden');
    exitCompareBtn.classList.remove('hidden');
    openCompareBtn.classList.add('hidden');
    populateCompareDropdown();
});

exitCompareBtn.addEventListener('click', () => {
    sidebar.classList.remove('expanded');
    colCompare.classList.add('hidden');
    exitCompareBtn.classList.add('hidden');
    openCompareBtn.classList.remove('hidden');
});

function populateCompareDropdown() {
    compareSelect.innerHTML = '<option value="" disabled selected>Select Community to Compare...</option>';
    communitiesData.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        // Handle duplicate names by adding context
        const duplicates = communitiesData.filter(oc => oc.name === c.name);
        opt.innerText = duplicates.length > 1 ? `${c.name} (${c.district}, ${c.country})` : c.name;
        compareSelect.appendChild(opt);
    });
}

compareSelect.addEventListener('change', (e) => {
    const communityId = e.target.value;
    const community = communitiesData.find(c => c.id === communityId);
    if (community) renderColumn(community, 'compare');
});

// Sidebar Core Toggle
hideBtn.addEventListener('click', () => {
    sidebar.classList.add('hidden');
    showBtn.classList.remove('hidden');
});

showBtn.addEventListener('click', () => {
    sidebar.classList.remove('hidden');
    showBtn.classList.add('hidden');
});

// Marker Logic
const markersGroup = L.layerGroup().addTo(map);
const communityMarkers = {};

function renderMarkers(countryFilter = "All") {
    markersGroup.clearLayers();
    Object.keys(communityMarkers).forEach(k => delete communityMarkers[k]);

    communitiesData.forEach(community => {
        if (countryFilter === "All" || community.country === countryFilter) {
            const marker = L.marker(community.coords);
            marker.on('click', () => {
                resetHighlights();
                renderColumn(community, 'main');
                sidebar.classList.remove('hidden');
                showBtn.classList.add('hidden');
            });
            markersGroup.addLayer(marker);
            communityMarkers[community.id] = marker;
        }
    });

    if (communitiesData.length > 0) {
        const bounds = L.latLngBounds(communitiesData.map(c => c.coords));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 8 });
    }
}
renderMarkers();
renderColumn(null, 'main');

function resetHighlights() {
    Object.values(communityMarkers).forEach(m => {
        const icon = m.getElement();
        if (icon) icon.classList.remove('leaflet-marker-highlighted');
    });
}

function highlightCommunities(communityIds) {
    resetHighlights();
    const markersToFit = [];
    communityIds.forEach(id => {
        const m = communityMarkers[id];
        if (m) {
            const icon = m.getElement();
            if (icon) icon.classList.add('leaflet-marker-highlighted');
            markersToFit.push(m.getLatLng());
        }
    });
    if (markersToFit.length > 0) {
        const bounds = L.latLngBounds(markersToFit);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 8 });
    }
}

document.getElementById('country-select').addEventListener('change', (e) => {
    const filter = e.target.value;
    renderMarkers(filter);
    resetHighlights();
    renderColumn(null, 'main'); // Render global view
    if (filter === "All") {
        if (communitiesData.length > 0) {
            const bounds = L.latLngBounds(communitiesData.map(c => c.coords));
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 8 });
        } else {
            map.setView([28.6, 80.8], 8);
        }
    } else {
        const c = staticData.countries.find(x => x.name === filter);
        if (c) map.setView(c.center, c.zoom);
    }
});

// Tab Logic
function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const col = btn.dataset.col; // 'main' or 'compare'
            const tab = btn.dataset.tab; // 'score', 'demographics', etc.

            // Update buttons in this column
            document.querySelectorAll(`.tab-btn[data-col="${col}"]`).forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update contents in this column
            document.querySelectorAll(`.tab-content[id*="-${col}"]`).forEach(c => c.classList.add('hidden'));
            document.getElementById(`tab-${tab}-${col}`).classList.remove('hidden');
        });
    });
}
initTabs();

// State
let needleAngles = { main: { t0: 0, t1: 0 }, compare: { t0: 0, t1: 0 } };
let animFrames = { main: null, compare: null };
let accordionState = { main: true, compare: true };

// Accordion Toggle Listeners
function initAccordionToggles() {
    ['main', 'compare'].forEach(side => {
        const btn = document.getElementById(`accordion-toggle-${side}`);
        if (btn) {
            btn.addEventListener('click', () => {
                accordionState[side] = !accordionState[side];
                btn.innerText = `Accordion: ${accordionState[side] ? 'ON' : 'OFF'}`;
                btn.classList.toggle('active');
            });
        }
    });
}
initAccordionToggles();

// Toggle Display Listeners (T0/T1)
['main', 'compare'].forEach(side => {
    ['t0', 't1'].forEach(type => {
        const el = document.getElementById(`show-${type}-${side}`);
        if (el) {
            el.addEventListener('change', () => {
                // Determine which community is currently active in this column
                let activeComm = null;
                if (side === 'main') {
                    const name = document.getElementById('community-name').innerText;
                    activeComm = communitiesData.find(c => c.name === name) || null;
                } else {
                    const id = compareSelect.value;
                    activeComm = communitiesData.find(c => c.id === id) || null;
                }
                renderColumn(activeComm, side);
            });
        }
    });
});

function renderColumn(community, colType) {
    if (colType === 'main') {
        const title = community ? community.name : "Global Overview";
        document.getElementById('community-name').innerText = title;

        // Inject Edit button if admin is logged in (KRO ONLY) and a community is selected
        const editArea = document.getElementById('admin-edit-area');
        editArea.innerHTML = '';
        if (isAdmin && currentUserRole === 'KRO' && community) {
            const editBtn = document.createElement('button');
            editBtn.className = 'toggle-btn-small';
            editBtn.style.marginTop = '8px';
            editBtn.innerText = '✏️ Edit Community';
            editBtn.onclick = () => openEditCommunityForm(community);
            editArea.appendChild(editBtn);
        }

        const gaugeGroup = document.getElementById('gauge-group-main');
        if (community) {
            gaugeGroup.classList.remove('hidden');
            animateGauge(community.t0_score, community.t1_score, 'gauge-canvas-main', 'main');
        } else {
            gaugeGroup.classList.add('hidden');
        }

        renderDemographics(community, 'demographics-text-main');
        renderActivities(community, 'activities-list-main');
        renderKnowledge(community, 'knowledge-list-main');
        renderCapitals(community, 'capitals-container-main', 'main');
    } else {
        if (!community) return;
        document.getElementById('compare-community-name').innerText = community.name;
        document.getElementById('gauge-group-compare').classList.remove('hidden');
        renderDemographics(community, 'demographics-text-compare');
        renderActivities(community, 'activities-list-compare');
        renderKnowledge(community, 'knowledge-list-compare');
        animateGauge(community.t0_score, community.t1_score, 'gauge-canvas-compare', 'compare');
        renderCapitals(community, 'capitals-container-compare', 'compare');
    }
}

function renderKnowledge(community, targetId) {
    const list = document.getElementById(targetId);
    list.innerHTML = '';

    if (community) {
        // Individual community: Group by name
        const related = activitiesData.filter(a => a.communityIds.includes(community.id) && a.knowledgeGenerated);
        const grouped = {};
        related.forEach(a => {
            const name = a.name;
            const time = (a.year && a.quarter) ? `${a.year}-Q${a.quarter}` : 'N/A';
            if (!grouped[name]) grouped[name] = [];
            grouped[name].push(time);
        });

        Object.keys(grouped).forEach(name => {
            const li = document.createElement('li');
            const times = [...new Set(grouped[name])].sort().join(', ');
            // Check if any instance has a link (for individual community, we can show one if it exists)
            const actWithLink = related.find(a => a.name === name && a.knowledgeLink);
            const linkHtml = actWithLink ? `<br><a href="${actWithLink.knowledgeLink}" target="_blank" style="color:var(--primary); font-size:0.8rem;">View Resource</a>` : '';
            
            li.innerHTML = `<strong>${name}</strong><br><small>Knowledge Instances: ${times}</small>${linkHtml}`;
            list.appendChild(li);
        });
        if (list.innerHTML === '') list.innerHTML = '<li class="form-hint">No knowledge-generating activities recorded for this community.</li>';
    } else {
        // Global Knowledge Hub: Confirmed activities + External links
        const confirmedActs = activitiesData.filter(a => a.knowledgeGenerated && a.knowledgeConfirmed);
        
        // Group confirmed by name
        const grouped = {};
        confirmedActs.forEach(a => {
            const name = a.name;
            const time = (a.year && a.quarter) ? `${a.year}-Q${a.quarter}` : 'N/A';
            if (!grouped[name]) grouped[name] = { times: [], commIds: [], links: [] };
            grouped[name].times.push(time);
            if (a.knowledgeLink) grouped[name].links.push(a.knowledgeLink);
            a.communityIds.forEach(cid => { if (!grouped[name].commIds.includes(cid)) grouped[name].commIds.push(cid); });
        });

        // Render Grouped Confirmed Activities
        Object.keys(grouped).forEach(name => {
            const li = document.createElement('li');
            li.className = 'activity-item-global';
            const times = [...new Set(grouped[name].times)].sort().join(', ');
            const links = [...new Set(grouped[name].links)];
            const linkHtml = links.length ? `<br>${links.map((l, i) => `<a href="${l}" target="_blank" style="color:var(--primary); font-size:0.75rem; margin-right:5px;" onclick="event.stopPropagation();">Link ${i+1}</a>`).join('')}` : '';
            
            li.innerHTML = `<strong>${name}</strong><small>Confirmed Knowledge · Active in ${grouped[name].commIds.length} locations (${times})</small>${linkHtml}`;
            li.onclick = () => highlightCommunities(grouped[name].commIds);
            list.appendChild(li);
        });

        // Render External Links
        externalKnowledgeLinks.forEach(link => {
            const li = document.createElement('li');
            li.className = 'activity-item-global';
            li.style.borderLeft = '4px solid #10b981';
            li.innerHTML = `<strong>${link.title}</strong><small>External Resource · Click to view</small>`;
            li.onclick = (e) => {
                e.stopPropagation();
                window.open(link.url, '_blank');
            };
            list.appendChild(li);
        });

        if (list.innerHTML === '') list.innerHTML = '<li class="form-hint">No confirmed knowledge or resources recorded globally.</li>';
    }
}

function renderDemographics(community, targetId) {
    const container = document.getElementById(targetId);
    let d;
    let title = "";

    if (community) {
        d = community.demographics;
        title = "Community Demographics";
    } else {
        // Aggregate totals for all/filtered communities
        const currentCountry = document.getElementById('country-select').value;
        const filtered = currentCountry === "All"
            ? communitiesData
            : communitiesData.filter(c => c.country === currentCountry);

        d = filtered.reduce((acc, curr) => {
            const cd = curr.demographics;
            acc.total += (cd.total || 0);
            acc.male += (cd.male || 0);
            acc.female += (cd.female || 0);
            acc.children += (cd.children || 0);
            acc.elderly += (cd.elderly || 0);
            acc.disabilities += (cd.disabilities || 0);
            return acc;
        }, { total: 0, male: 0, female: 0, children: 0, elderly: 0, disabilities: 0 });

        d.description = `Aggregate data across ${filtered.length} communities in ${currentCountry === "All" ? "all regions" : currentCountry}.`;
        title = `Total Demographics (${currentCountry})`;
    }

    container.innerHTML = `
        <h3 style="margin-bottom: 15px; font-size: 0.9rem; color: var(--primary); text-transform: uppercase; letter-spacing: 0.05em;">${title}</h3>
        <div class="demo-grid">
            <div class="demo-item"><i data-lucide="users"></i> <div><span class="demo-label">Total</span><span class="demo-value">${d.total.toLocaleString()}</span></div></div>
            <div class="demo-item"><i data-lucide="user"></i> <div><span class="demo-label">Male</span><span class="demo-value">${d.male.toLocaleString()}</span></div></div>
            <div class="demo-item"><i data-lucide="user-plus"></i> <div><span class="demo-label">Female</span><span class="demo-value">${d.female.toLocaleString()}</span></div></div>
            <div class="demo-item"><i data-lucide="baby"></i> <div><span class="demo-label">Children</span><span class="demo-value">${d.children.toLocaleString()}</span></div></div>
            <div class="demo-item"><i data-lucide="accessibility"></i> <div><span class="demo-label">Elderly</span><span class="demo-value">${d.elderly.toLocaleString()}</span></div></div>
            <div class="demo-item"><i data-lucide="contact"></i> <div><span class="demo-label">Disabilities</span><span class="demo-value">${d.disabilities.toLocaleString()}</span></div></div>
        </div>
        <div class="demo-description">${d.description}</div>
    `;
    lucide.createIcons();
}

function renderActivities(community, targetId, countryFilter = "All") {
    const list = document.getElementById(targetId);
    list.innerHTML = '';

    if (community) {
        const related = activitiesData.filter(a => a.communityIds.includes(community.id));
        const grouped = {};
        related.forEach(a => {
            const name = a.name;
            const time = (a.year && a.quarter) ? `${a.year}-Q${a.quarter}` : 'N/A';
            if (!grouped[name]) grouped[name] = [];
            grouped[name].push(time);
        });

        Object.keys(grouped).forEach(name => {
            const li = document.createElement('li');
            const times = [...new Set(grouped[name])].sort().join(', ');
            li.innerHTML = `<strong>${name}</strong><small> | ${times}</small>`;
            list.appendChild(li);
        });
    } else {
        const uniqueActs = [];
        activitiesData.forEach(a => {
            const filteredCommIds = countryFilter === "All"
                ? a.communityIds
                : a.communityIds.filter(id => {
                    const c = communitiesData.find(comm => comm.id === id);
                    return c && c.country === countryFilter;
                });

            if (filteredCommIds.length > 0) {
                if (!uniqueActs.find(x => x.name === a.name)) {
                    uniqueActs.push({ name: a.name, communityIds: [...filteredCommIds] });
                } else {
                    const existing = uniqueActs.find(x => x.name === a.name);
                    filteredCommIds.forEach(id => {
                        if (!existing.communityIds.includes(id)) existing.communityIds.push(id);
                    });
                }
            }
        });

        uniqueActs.forEach(act => {
            const li = document.createElement('li');
            li.className = 'activity-item-global';
            li.innerHTML = `<strong>${act.name}</strong><small>Undertaken in ${act.communityIds.length} communities</small>`;
            li.onclick = () => highlightCommunities(act.communityIds);
            list.appendChild(li);
        });
    }
}

function animateGauge(targetT0, targetT1, canvasId, side) {
    const startT0 = needleAngles[side].t0;
    const startT1 = needleAngles[side].t1;
    let startTime = null;
    const duration = 800;

    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        needleAngles[side].t0 = startT0 + (targetT0 - startT0) * ease;
        needleAngles[side].t1 = startT1 + (targetT1 - startT1) * ease;
        drawGauge(needleAngles[side].t0, needleAngles[side].t1, canvasId, side);
        if (progress < 1) animFrames[side] = requestAnimationFrame(step);
    }
    cancelAnimationFrame(animFrames[side]);
    animFrames[side] = requestAnimationFrame(step);
}

function drawGauge(t0, t1, canvasId, side) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = canvas.width / 2, cy = canvas.height - 20, r = 100;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 0);
    ctx.lineWidth = 20; ctx.strokeStyle = '#e2e8f0'; ctx.stroke();

    const showT0 = document.getElementById(`show-t0-${side}`).checked;
    const showT1 = document.getElementById(`show-t1-${side}`).checked;

    if (showT0) drawNeedle(ctx, cx, cy, r - 10, (t0 / 100) * Math.PI, '#94a3b8');
    if (showT1) drawNeedle(ctx, cx, cy, r, (t1 / 100) * Math.PI, '#2563eb');

    // Update labels visibility
    document.getElementById(`label-t0-${side}`).style.opacity = showT0 ? '1' : '0';
    document.getElementById(`label-t1-${side}`).style.opacity = showT1 ? '1' : '0';
}

function drawNeedle(ctx, x, y, len, angle, color) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI + angle);
    ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(len, 0); ctx.lineTo(0, 2);
    ctx.fillStyle = color; ctx.fill(); ctx.restore();
}

function renderCapitals(community, containerId, side) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    if (!community) {
        // Global / Home Mode: Show Theoretical Definitions
        const defHeader = document.createElement('h3');
        defHeader.innerText = "Theoretical Definitions";
        defHeader.style.margin = "10px 0 20px 0";
        defHeader.style.fontSize = "0.9rem";
        defHeader.style.color = "var(--primary)";
        defHeader.style.textTransform = "uppercase";
        container.appendChild(defHeader);

        staticData.capitals.forEach(cap => {
            const defDiv = document.createElement('div');
            defDiv.className = 'info-card';
            defDiv.style.marginBottom = '15px';
            defDiv.style.borderLeft = `4px solid ${cap.color}`;
            defDiv.innerHTML = `
                <div style="font-weight: 700; color: ${cap.color}; margin-bottom: 5px;">${cap.name}</div>
                <div style="font-size: 0.85rem; line-height: 1.5; color: var(--text-muted);">${cap.description}</div>
            `;
            container.appendChild(defDiv);
        });
        return;
    }

    staticData.capitals.forEach(cap => {
        const capDiv = document.createElement('div');
        capDiv.className = 'capital-item';
        const indList = indicatorsData[cap.id] || [];
        let degraded = indList.some(i => {
            const g = community.gradings[i.id];
            return g && Number(g.t1) < Number(g.t0);
        });
        if (degraded) capDiv.classList.add('capital-degraded');
        capDiv.innerHTML = `<div class="capital-header" style="background: ${cap.color}"><span>${cap.name}</span><span class="chevron">▼</span></div><div class="indicators-list"></div>`;
        const list = capDiv.querySelector('.indicators-list');

        indList.forEach(ind => {
            const grad = community.gradings[ind.id];
            const isDeg = grad ? Number(grad.t1) < Number(grad.t0) : false;
            const indDiv = document.createElement('div');
            indDiv.className = `indicator-item ${isDeg ? 'indicator-degraded' : ''}`;
            const related = activitiesData.filter(a => a.communityIds.includes(community.id) && a.indicatorIds.includes(ind.id));
            
            // Group activities by name
            const grouped = {};
            related.forEach(a => {
                const name = a.name;
                const time = (a.year && a.quarter) ? `${a.year}-Q${a.quarter}` : 'N/A';
                if (!grouped[name]) grouped[name] = [];
                grouped[name].push(time);
            });

            const relatedHtml = Object.keys(grouped).length 
                ? Object.keys(grouped).map(name => {
                    const times = [...new Set(grouped[name])].join(', ');
                    return `<li>${name} (${times})</li>`;
                }).join('') 
                : '<li>No specific activities recorded</li>';
            
            const showT0 = document.getElementById(`show-t0-${side}`).checked;
            const showT1 = document.getElementById(`show-t1-${side}`).checked;

            const t0Text = showT0 ? `T0: ${grad ? grad.t0 : 'N/A'}` : '';
            const t1Text = showT1 ? `T1: ${grad ? grad.t1 : 'N/A'}` : '';
            const arrow = (showT0 && showT1) ? ' <span class="arrow">→</span> ' : '';

            indDiv.innerHTML = `
                <div class="indicator-header"><span>${ind.name}</span><span class="${isDeg && showT0 && showT1 ? 'grade-degraded' : ''}">${t0Text}${arrow}${t1Text}</span></div>
                <div class="activity-sublist"><strong>Contributing Activities:</strong><ul>${relatedHtml}</ul></div>
            `;

            indDiv.onclick = (e) => {
                e.stopPropagation();
                const sub = indDiv.querySelector('.activity-sublist');
                const isCurrentlyVisible = sub.style.display === 'block';

                if (accordionState[side]) {
                    // Accordion: Collapse all other indicators in this capital
                    list.querySelectorAll('.activity-sublist').forEach(s => s.style.display = 'none');
                }

                // Toggle current
                sub.style.display = isCurrentlyVisible ? 'none' : 'block';
            };
            list.appendChild(indDiv);
        });

        capDiv.querySelector('.capital-header').onclick = () => {
            const isCurrentlyVisible = list.style.display === 'block';

            if (accordionState[side]) {
                // Accordion: Collapse all other capitals in this container
                container.querySelectorAll('.indicators-list').forEach(l => l.style.display = 'none');
                container.querySelectorAll('.chevron').forEach(c => c.innerText = '▼');
            }

            // Toggle current
            list.style.display = isCurrentlyVisible ? 'none' : 'block';
            capDiv.querySelector('.chevron').innerText = isCurrentlyVisible ? '▼' : '▲';
        };
        container.appendChild(capDiv);
    });
}

// ===== ACTIVITY MANAGEMENT =====

function saveActivitiesToStorage() {
    // Save only non-baseline activities (added or modified)
    const baseline = activities.map(a => a.id);
    const userAdded = activitiesData.filter(a => !baseline.includes(a.id));
    // Also persist communityId mutations on baseline items
    const allForStorage = activitiesData.map(a => ({ ...a }));
    localStorage.setItem('added_activities_v2', JSON.stringify(allForStorage));
}

// Inline 'Add New Activity' in community form
document.getElementById('add-inline-activity-btn').addEventListener('click', () => {
    const actName = document.getElementById('inline-new-act-name').value.trim();
    if (!actName) return alert('Please enter an activity name.');

    const selectedInds = [];
    document.querySelectorAll('.inline-ind-cb:checked').forEach(cb => selectedInds.push(cb.value));

    const actYear = document.getElementById('inline-act-year').value;
    const actQuarter = document.getElementById('inline-act-quarter').value;

    const newAct = {
        id: 'act_' + Date.now(),
        name: actName,
        year: actYear,
        quarter: actQuarter,
        indicatorIds: selectedInds,
        communityIds: [],
        knowledgeGenerated: false,
        knowledgeConfirmed: false,
        knowledgeLink: ''
    };

    activitiesData.push(newAct);
    saveActivitiesToStorage();

    // Refresh the checklist and pre-check the new activity
    const checklistEl = document.getElementById('activity-checklist');
    const label = document.createElement('label');
    label.className = 'check-label';
    label.innerHTML = `<input type="checkbox" id="actcb_${newAct.id}" value="${newAct.id}" checked> ${newAct.name}`;
    checklistEl.appendChild(label);

    // Clear the inline form
    document.getElementById('inline-new-act-name').value = '';
    document.getElementById('inline-act-year').value = '';
    document.getElementById('inline-act-quarter').value = '1';
    document.querySelectorAll('.inline-ind-cb').forEach(cb => cb.checked = false);

    alert(`Activity "${actName}" added and pre-selected!`);
});

// Manage Communities Modal
manageCommunitiesBtn.addEventListener('click', () => {
    openManageCommunitiesModal();
});

document.getElementById('close-communities-modal').addEventListener('click', () => {
    manageCommModal.classList.add('hidden');
});

function openManageCommunitiesModal() {
    renderManageCommunitiesList();
    manageCommModal.classList.remove('hidden');
}

function renderManageCommunitiesList() {
    const listEl = document.getElementById('manage-communities-list');
    listEl.innerHTML = '';
    communitiesData.forEach(c => {
        const item = document.createElement('div');
        item.className = 'manage-act-item';
        item.innerHTML = `
            <div>
                <strong>${c.name}</strong>
                <small>${c.district}, ${c.country} · Pop: ${c.demographics.total.toLocaleString()}</small>
            </div>
            <div style="display:flex; gap:8px;">
                <button class="toggle-btn-small" onclick="openEditCommunityFormById('${c.id}')">Edit</button>
                <button class="toggle-btn-small danger-small" onclick="permanentlyDeleteCommunity('${c.id}')">Archive</button>
            </div>
        `;
        listEl.appendChild(item);
    });
}

// Global helper for edit
window.openEditCommunityFormById = function(id) {
    const comm = communitiesData.find(c => c.id === id);
    if (comm) {
        manageCommModal.classList.add('hidden');
        openEditCommunityForm(comm);
    }
};

// Manage Activities Modal
manageActivitiesBtn.addEventListener('click', () => {
    openManageActivitiesModal();
});

document.getElementById('close-manage-activities').addEventListener('click', () => {
    manageActModal.classList.add('hidden');
});

function openManageActivitiesModal() {
    clearActivityForm();
    populateManageActivityLists();
    manageActModal.classList.remove('hidden');
}

function populateManageActivityLists() {
    // Community Checklist
    const commList = document.getElementById('act-community-checklist');
    commList.innerHTML = '';
    communitiesData.forEach(c => {
        const lbl = document.createElement('label');
        lbl.className = 'check-label';
        lbl.innerHTML = `<input type="checkbox" class="act-comm-cb" value="${c.id}"> ${c.name} (${c.country})`;
        commList.appendChild(lbl);
    });

    // Indicator Checklist
    const indList = document.getElementById('act-indicator-checklist');
    indList.innerHTML = '';
    staticData.capitals.forEach(cap => {
        const inds = indicatorsData[cap.id] || [];
        inds.forEach(ind => {
            const lbl = document.createElement('label');
            lbl.className = 'check-label';
            lbl.innerHTML = `<input type="checkbox" class="act-ind-cb" value="${ind.id}"> <span style="color:${cap.color}">${cap.name}: ${ind.name}</span>`;
            indList.appendChild(lbl);
        });
    });

    // Activities List
    renderManageActivitiesList();

    // Activity Name Suggestions (Datalist)
    const datalist = document.getElementById('activity-name-suggestions');
    const uniqueNames = [...new Set(activitiesData.map(a => a.name))].sort();
    datalist.innerHTML = uniqueNames.map(name => `<option value="${name}">`).join('');
}

function renderManageActivitiesList() {
    const listEl = document.getElementById('manage-activities-list');
    listEl.innerHTML = '';
    activitiesData.forEach(act => {
        const item = document.createElement('div');
        item.className = 'manage-act-item';
        const timeInfo = (act.year && act.quarter) ? ` (${act.year}-${act.quarter})` : '';
        item.innerHTML = `
            <div>
                <strong>${act.name}${timeInfo}</strong>
                <small>${act.communityIds.length} communities · ${act.indicatorIds.length} indicators</small>
            </div>
            <div style="display:flex; gap:8px;">
                <button class="toggle-btn-small" onclick="editActivityInModal('${act.id}')">Edit</button>
                <button class="toggle-btn-small danger-small" onclick="deleteActivity('${act.id}')">Delete</button>
            </div>
        `;
        listEl.appendChild(item);
    });
}

function editActivityInModal(actId) {
    const act = activitiesData.find(a => a.id === actId);
    if (!act) return;
    document.getElementById('act-edit-id').value = act.id;
    document.getElementById('act-name-input').value = act.name;
    document.getElementById('act-year-input').value = act.year || '';
    document.getElementById('act-quarter-input').value = act.quarter || 'Q1';
    document.getElementById('act-knowledge-input').checked = !!act.knowledgeGenerated;
    
    document.querySelectorAll('.act-comm-cb').forEach(cb => {
        cb.checked = act.communityIds.includes(cb.value);
    });
    document.querySelectorAll('.act-ind-cb').forEach(cb => {
        cb.checked = act.indicatorIds.includes(cb.value);
    });
}

function deleteActivity(actId) {
    if (!confirm('Archive this activity? You can restore it later from the Archive.')) return;
    
    // Move to archivedActivityIds
    if (!archivedActivityIds.includes(actId)) {
        archivedActivityIds.push(actId);
        localStorage.setItem('archived_activities_v2', JSON.stringify(archivedActivityIds));
    }
    
    // Remove from active activitiesData
    activitiesData = activitiesData.filter(a => a.id !== actId);
    
    renderManageActivitiesList();
    renderColumn(null, 'main');
    alert('Activity archived.');
}

function clearActivityForm() {
    document.getElementById('act-edit-id').value = '';
    document.getElementById('act-name-input').value = '';
    document.getElementById('act-year-input').value = '';
    document.getElementById('act-quarter-input').value = 'Q1';
    document.getElementById('act-knowledge-input').checked = false;
    document.querySelectorAll('.act-ben-men, .act-ben-women, .act-ben-oldMen, .act-ben-oldWomen, .act-ben-newMen, .act-ben-newWomen').forEach(input => input.value = 0);
    document.querySelectorAll('.act-comm-cb, .act-ind-cb').forEach(cb => cb.checked = false);
}

document.getElementById('save-activity-btn').addEventListener('click', () => {
    const actName = document.getElementById('act-name-input').value.trim();
    if (!actName) return alert('Please enter an activity name.');

    const selectedComms = [];
    document.querySelectorAll('.act-comm-cb:checked').forEach(cb => selectedComms.push(cb.value));
    const selectedInds = [];
    document.querySelectorAll('.act-ind-cb:checked').forEach(cb => selectedInds.push(cb.value));

    const actYear = document.getElementById('act-year-input').value;
    const actQuarter = document.getElementById('act-quarter-input').value;
    const knowledgeGenerated = document.getElementById('act-knowledge-input').checked;

    const ben = {
        men: parseInt(document.getElementById('act-ben-men').value) || 0,
        women: parseInt(document.getElementById('act-ben-women').value) || 0,
        oldMen: parseInt(document.getElementById('act-ben-oldMen').value) || 0,
        oldWomen: parseInt(document.getElementById('act-ben-oldWomen').value) || 0,
        newMen: parseInt(document.getElementById('act-ben-newMen').value) || 0,
        newWomen: parseInt(document.getElementById('act-ben-newWomen').value) || 0
    };

    const editId = document.getElementById('act-edit-id').value;
    if (editId) {
        const idx = activitiesData.findIndex(a => a.id === editId);
        if (idx !== -1) {
            activitiesData[idx].name = actName;
            activitiesData[idx].year = actYear;
            activitiesData[idx].quarter = actQuarter;
            activitiesData[idx].communityIds = selectedComms;
            activitiesData[idx].indicatorIds = selectedInds;
            activitiesData[idx].knowledgeGenerated = knowledgeGenerated;
            activitiesData[idx].beneficiaries = ben;
        }
    } else {
        activitiesData.push({
            id: 'act_' + Date.now(),
            name: actName,
            year: actYear,
            quarter: actQuarter,
            communityIds: selectedComms,
            indicatorIds: selectedInds,
            knowledgeGenerated: knowledgeGenerated,
            knowledgeConfirmed: false,
            knowledgeLink: '',
            beneficiaries: ben
        });
    }
    saveActivitiesToStorage();
    clearActivityForm();
    renderManageActivitiesList();
    renderColumn(null, 'main');
    alert('Activity saved!');
});

document.getElementById('clear-act-form-btn').addEventListener('click', () => {
    clearActivityForm();
});

// ===== KNOWLEDGE MANAGEMENT =====
let knowModalTab = 'verify';

manageKnowledgeBtn.addEventListener('click', () => {
    openManageKnowledgeModal();
});

document.getElementById('close-knowledge-modal').addEventListener('click', () => {
    manageKnowledgeModal.classList.add('hidden');
});

document.getElementById('know-tab-verify').addEventListener('click', () => {
    knowModalTab = 'verify';
    updateKnowModalTabs();
});

document.getElementById('know-tab-links').addEventListener('click', () => {
    knowModalTab = 'links';
    updateKnowModalTabs();
});

function updateKnowModalTabs() {
    document.getElementById('know-tab-verify').classList.toggle('active', knowModalTab === 'verify');
    document.getElementById('know-tab-links').classList.toggle('active', knowModalTab === 'links');
    document.getElementById('know-verify-section').classList.toggle('hidden', knowModalTab !== 'verify');
    document.getElementById('know-links-section').classList.toggle('hidden', knowModalTab !== 'links');
    if (knowModalTab === 'verify') renderKnowVerifyList();
    else renderExtKnowList();
}

function openManageKnowledgeModal() {
    knowModalTab = 'verify';
    updateKnowModalTabs();
    manageKnowledgeModal.classList.remove('hidden');
}

function renderKnowVerifyList() {
    const listEl = document.getElementById('know-verify-list');
    listEl.innerHTML = '';
    
    // Activities flagged for knowledge
    const candidates = activitiesData.filter(a => a.knowledgeGenerated);
    
    if (candidates.length === 0) {
        listEl.innerHTML = '<p class="form-hint">No activities have "Knowledge Generated" checked.</p>';
        return;
    }

    candidates.forEach(a => {
        const item = document.createElement('div');
        item.className = 'manage-act-item';
        const status = a.knowledgeConfirmed ? '✅ Confirmed' : '⏳ Pending';
        item.innerHTML = `
            <div>
                <strong>${a.name}</strong> <small>(${a.year || 'N/A'}-Q${a.quarter || '1'})</small><br>
                <small>${status} · Active in ${a.communityIds.length} locs</small>
            </div>
            <button class="toggle-btn-small ${a.knowledgeConfirmed ? 'danger-small' : 'primary-small'}" onclick="toggleKnowConfirmation('${a.id}')">
                ${a.knowledgeConfirmed ? 'Unconfirm' : 'Confirm'}
            </button>
        `;
        listEl.appendChild(item);
    });
}

window.toggleKnowConfirmation = function(id) {
    const act = activitiesData.find(a => a.id === id);
    if (act) {
        act.knowledgeConfirmed = !act.knowledgeConfirmed;
        
        if (act.knowledgeConfirmed) {
            const link = prompt("Enter a website link for this knowledge (optional):", act.knowledgeLink || "");
            if (link !== null) act.knowledgeLink = link.trim();
        }

        saveActivitiesToStorage();
        renderKnowVerifyList();
        renderColumn(null, 'main'); // Refresh homepage
    }
};

function renderExtKnowList() {
    const listEl = document.getElementById('ext-know-list');
    listEl.innerHTML = '';
    
    if (externalKnowledgeLinks.length === 0) {
        listEl.innerHTML = '<p class="form-hint">No external links added.</p>';
        return;
    }

    externalKnowledgeLinks.forEach((link, idx) => {
        const item = document.createElement('div');
        item.className = 'manage-act-item';
        item.innerHTML = `
            <div>
                <strong>${link.title}</strong><br>
                <small>${link.url}</small>
            </div>
            <button class="toggle-btn-small danger-small" onclick="deleteExtKnow(${idx})">Delete</button>
        `;
        listEl.appendChild(item);
    });
}

document.getElementById('save-ext-know-btn').addEventListener('click', () => {
    const title = document.getElementById('ext-know-title').value.trim();
    const url = document.getElementById('ext-know-url').value.trim();
    
    if (!title || !url) return alert('Please enter both title and URL.');
    
    externalKnowledgeLinks.push({ title, url });
    localStorage.setItem('crmc_external_knowledge', JSON.stringify(externalKnowledgeLinks));
    
    document.getElementById('ext-know-title').value = '';
    document.getElementById('ext-know-url').value = '';
    
    renderExtKnowList();
    renderColumn(null, 'main');
    alert('External link added!');
});

window.deleteExtKnow = function(idx) {
    if (!confirm('Delete this external link?')) return;
    externalKnowledgeLinks.splice(idx, 1);
    localStorage.setItem('crmc_external_knowledge', JSON.stringify(externalKnowledgeLinks));
    renderExtKnowList();
    renderColumn(null, 'main');
};

// ===== ARCHIVE MANAGEMENT =====
let archiveCurrentTab = 'comm'; // 'comm' or 'act'

archivedCommunitiesBtn.addEventListener('click', () => {
    openArchiveModal();
});

document.getElementById('close-archive-modal').addEventListener('click', () => {
    archiveModal.classList.add('hidden');
});

document.getElementById('archive-tab-comm').addEventListener('click', () => {
    archiveCurrentTab = 'comm';
    updateArchiveTabStyles();
    renderArchiveList();
});

document.getElementById('archive-tab-act').addEventListener('click', () => {
    archiveCurrentTab = 'act';
    updateArchiveTabStyles();
    renderArchiveList();
});

function updateArchiveTabStyles() {
    document.getElementById('archive-tab-comm').classList.toggle('active', archiveCurrentTab === 'comm');
    document.getElementById('archive-tab-act').classList.toggle('active', archiveCurrentTab === 'act');
}

function openArchiveModal() {
    updateArchiveTabStyles();
    renderArchiveList();
    archiveModal.classList.remove('hidden');
}

function renderArchiveList() {
    const listEl = document.getElementById('archive-list');
    listEl.innerHTML = '';
    
    if (archiveCurrentTab === 'comm') {
        renderArchivedCommunities(listEl);
    } else {
        renderArchivedActivities(listEl);
    }
}

function renderArchivedCommunities(listEl) {
    if (archivedCommunityIds.length === 0) {
        listEl.innerHTML = '<p class="form-hint" style="text-align:center;">No archived communities.</p>';
        return;
    }
    
    const allKnown = [...communities, ...JSON.parse(localStorage.getItem('added_communities_v2') || '[]')];
    
    archivedCommunityIds.forEach(id => {
        const c = allKnown.find(x => x.id === id);
        if (!c) return;
        
        const item = document.createElement('div');
        item.className = 'manage-act-item';
        item.innerHTML = `
            <div>
                <strong>${c.name}</strong>
                <small>${c.district}, ${c.country}</small>
            </div>
            <div style="display:flex; gap:8px;">
                <button class="toggle-btn-small" onclick="restoreCommunity('${c.id}')">Restore</button>
                <button class="toggle-btn-small danger-small" onclick="permanentlyDeleteCommunity('${c.id}')">Delete</button>
            </div>
        `;
        listEl.appendChild(item);
    });
}

function renderArchivedActivities(listEl) {
    if (archivedActivityIds.length === 0) {
        listEl.innerHTML = '<p class="form-hint" style="text-align:center;">No archived activities.</p>';
        return;
    }
    
    const allKnownActivities = [...activities, ...JSON.parse(localStorage.getItem('added_activities_v2') || '[]')];
    
    archivedActivityIds.forEach(id => {
        const a = allKnownActivities.find(x => x.id === id);
        if (!a) return;
        
        const item = document.createElement('div');
        item.className = 'manage-act-item';
        item.innerHTML = `
            <div>
                <strong>${a.name}</strong>
                <small>${a.communityIds.length} locations</small>
            </div>
            <div style="display:flex; gap:8px;">
                <button class="toggle-btn-small" onclick="restoreActivity('${a.id}')">Restore</button>
                <button class="toggle-btn-small danger-small" onclick="permanentlyDeleteActivity('${a.id}')">Delete</button>
            </div>
        `;
        listEl.appendChild(item);
    });
}

window.restoreCommunity = function(id) {
    const idx = archivedCommunityIds.indexOf(id);
    if (idx !== -1) {
        archivedCommunityIds.splice(idx, 1);
        localStorage.setItem('archived_communities_v2', JSON.stringify(archivedCommunityIds));
        
        // Reload communitiesData
        const saved = JSON.parse(localStorage.getItem('added_communities_v2') || '[]');
        communitiesData = [...communities, ...saved].filter(c => !archivedCommunityIds.includes(c.id));
        
        renderMarkers();
        populateCompareDropdown();
        renderArchiveList();
        alert('Community restored!');
    }
};

window.permanentlyDeleteCommunity = function(id) {
    if (!confirm('Permanently delete this community from storage? This cannot be undone.')) return;
    
    const idx = archivedCommunityIds.indexOf(id);
    if (idx !== -1) {
        archivedCommunityIds.splice(idx, 1);
        localStorage.setItem('archived_communities_v2', JSON.stringify(archivedCommunityIds));
        
        const saved = JSON.parse(localStorage.getItem('added_communities_v2') || '[]');
        const updatedSaved = saved.filter(c => c.id !== id);
        localStorage.setItem('added_communities_v2', JSON.stringify(updatedSaved));
        
        // Also cleanup activity associations
        activitiesData.forEach(act => {
            act.communityIds = act.communityIds.filter(cid => cid !== id);
        });
        saveActivitiesToStorage();
        
        renderArchiveList();
        alert('Community deleted permanently.');
    }
};

window.restoreActivity = function(id) {
    const idx = archivedActivityIds.indexOf(id);
    if (idx !== -1) {
        archivedActivityIds.splice(idx, 1);
        localStorage.setItem('archived_activities_v2', JSON.stringify(archivedActivityIds));
        
        // Reload activitiesData
        const saved = JSON.parse(localStorage.getItem('added_activities_v2') || '[]');
        activitiesData = [...activities, ...saved].filter(a => !archivedActivityIds.includes(a.id));
        
        renderArchiveList();
        renderColumn(null, 'main');
        alert('Activity restored!');
    }
};

window.permanentlyDeleteActivity = function(id) {
    if (!confirm('Permanently delete this activity? This cannot be undone.')) return;
    
    const idx = archivedActivityIds.indexOf(id);
    if (idx !== -1) {
        archivedActivityIds.splice(idx, 1);
        localStorage.setItem('archived_activities_v2', JSON.stringify(archivedActivityIds));
        
        const saved = JSON.parse(localStorage.getItem('added_activities_v2') || '[]');
        const updatedSaved = saved.filter(a => a.id !== id);
        localStorage.setItem('added_activities_v2', JSON.stringify(updatedSaved));
        
        renderArchiveList();
        alert('Activity deleted permanently.');
    }
};

// ===== USER MANAGEMENT =====
manageUsersBtn.addEventListener('click', () => {
    renderUsersList();
    manageUsersModal.classList.remove('hidden');
});

document.getElementById('close-users-modal').addEventListener('click', () => {
    manageUsersModal.classList.add('hidden');
});

function renderUsersList() {
    const listEl = document.getElementById('manage-users-list');
    listEl.innerHTML = '';
    usersData.forEach((user, idx) => {
        const item = document.createElement('div');
        item.className = 'manage-act-item';
        item.innerHTML = `
            <div>
                <strong>${user.name}</strong>
                <small>Role: ${user.role}</small>
            </div>
            <div>
                ${user.name !== 'admin' ? `<button class="toggle-btn-small danger-small" onclick="deleteUser(${idx})">Remove</button>` : ''}
            </div>
        `;
        listEl.appendChild(item);
    });
}

document.getElementById('save-user-btn').addEventListener('click', () => {
    const name = document.getElementById('user-name-input').value.trim();
    const pass = document.getElementById('user-pass-input').value.trim();
    const role = document.getElementById('user-role-input').value;

    if (!name || !pass) return alert('Username and password are required.');
    if (usersData.find(u => u.name === name)) return alert('Username already exists.');

    usersData.push({ name, pass, role });
    localStorage.setItem('crmc_users', JSON.stringify(usersData));
    
    document.getElementById('user-name-input').value = '';
    document.getElementById('user-pass-input').value = '';
    renderUsersList();
    alert('User added successfully!');
});

window.deleteUser = function(idx) {
    if (!confirm('Are you sure you want to remove this user?')) return;
    usersData.splice(idx, 1);
    localStorage.setItem('crmc_users', JSON.stringify(usersData));
    renderUsersList();
};

// ===== INDICATOR MANAGEMENT =====
manageIndBtn.addEventListener('click', () => {
    const capSelect = document.getElementById('ind-capital-input');
    capSelect.innerHTML = staticData.capitals.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    renderIndicatorsList();
    manageIndModal.classList.remove('hidden');
});

document.getElementById('close-indicators-modal').addEventListener('click', () => {
    manageIndModal.classList.add('hidden');
});

function renderIndicatorsList() {
    const listEl = document.getElementById('manage-indicators-list');
    listEl.innerHTML = '';
    
    staticData.capitals.forEach(cap => {
        const inds = indicatorsData[cap.id] || [];
        const capHeader = document.createElement('div');
        capHeader.style.fontWeight = 'bold';
        capHeader.style.color = cap.color;
        capHeader.style.marginTop = '15px';
        capHeader.style.padding = '4px';
        capHeader.style.background = 'rgba(0,0,0,0.03)';
        capHeader.innerText = cap.name;
        listEl.appendChild(capHeader);
        
        inds.forEach(ind => {
            const item = document.createElement('div');
            item.className = 'manage-act-item';
            item.innerHTML = `
                <div>${ind.name}</div>
                <div style="display:flex; gap:8px;">
                    <button class="toggle-btn-small" onclick="editIndicatorInModal('${cap.id}', '${ind.id}')">Edit</button>
                    <button class="toggle-btn-small danger-small" onclick="deleteIndicator('${cap.id}', '${ind.id}')">Remove</button>
                </div>
            `;
            listEl.appendChild(item);
        });
    });
}

window.editIndicatorInModal = function(capId, indId) {
    const ind = (indicatorsData[capId] || []).find(i => i.id === indId);
    if (!ind) return;
    document.getElementById('ind-edit-id').value = ind.id;
    document.getElementById('ind-name-input').value = ind.name;
    document.getElementById('ind-capital-input').value = capId;
    document.getElementById('ind-capital-input').disabled = true; // Don't allow changing capital during edit for data integrity
};

document.getElementById('clear-ind-form-btn').addEventListener('click', () => {
    clearIndForm();
});

function clearIndForm() {
    document.getElementById('ind-edit-id').value = '';
    document.getElementById('ind-name-input').value = '';
    document.getElementById('ind-capital-input').disabled = false;
}

document.getElementById('save-indicator-btn').addEventListener('click', () => {
    const name = document.getElementById('ind-name-input').value.trim();
    const capId = document.getElementById('ind-capital-input').value;
    const editId = document.getElementById('ind-edit-id').value;

    if (!name) return alert('Indicator name is required.');

    if (editId) {
        // Edit existing
        const idx = indicatorsData[capId].findIndex(i => i.id === editId);
        if (idx !== -1) {
            indicatorsData[capId][idx].name = name;
        }
    } else {
        // Add new
        const newInd = { id: 'ind_' + Date.now(), name: name };
        if (!indicatorsData[capId]) indicatorsData[capId] = [];
        indicatorsData[capId].push(newInd);
    }
    
    localStorage.setItem('crmc_indicators_v3', JSON.stringify(indicatorsData));
    
    clearIndForm();
    renderIndicatorsList();
    alert(editId ? 'Indicator updated!' : 'Indicator added!');
});

window.deleteIndicator = function(capId, indId) {
    if (!confirm('Are you sure you want to remove this indicator? Data already assigned to this indicator in communities will persist but the indicator name may show as N/A.')) return;
    
    indicatorsData[capId] = indicatorsData[capId].filter(i => i.id !== indId);
    localStorage.setItem('crmc_indicators_v3', JSON.stringify(indicatorsData));
    
    renderIndicatorsList();
};
// ===== KRO DASHBOARD & CHARTS =====
const dashboardModal = document.getElementById('admin-dashboard-modal');
const kroDashboardBtn = document.getElementById('kro-dashboard-btn');
let reachChart = null;
let pieChart = null;

kroDashboardBtn.addEventListener('click', () => {
    openDashboard();
});

document.getElementById('close-dashboard-modal').addEventListener('click', () => {
    dashboardModal.classList.add('hidden');
});

function openDashboard() {
    populateDashboardFilters();
    updateDashboard();
    dashboardModal.classList.remove('hidden');
}

function populateDashboardFilters() {
    const countrySelect = document.getElementById('dash-filter-country'); // In case not there
    const provSelect = document.getElementById('dash-filter-province');
    const distSelect = document.getElementById('dash-filter-district');
    const commSelect = document.getElementById('dash-filter-community');

    // Simple unique extraction
    const provinces = [...new Set(communitiesData.map(c => c.province))].filter(Boolean).sort();
    const districts = [...new Set(communitiesData.map(c => c.district))].filter(Boolean).sort();

    provSelect.innerHTML = '<option value="All">All Provinces</option>' + provinces.map(p => `<option value="${p}">${p}</option>`).join('');
    distSelect.innerHTML = '<option value="All">All Districts</option>' + districts.map(d => `<option value="${d}">${d}</option>`).join('');
    
    // For communities, ensure unique ID but show name + context for duplicates
    commSelect.innerHTML = '<option value="All">All Communities</option>' + communitiesData.map(c => {
        const duplicates = communitiesData.filter(oc => oc.name === c.name);
        const displayName = duplicates.length > 1 ? `${c.name} (${c.district}, ${c.country})` : c.name;
        return `<option value="${c.id}">${displayName}</option>`;
    }).join('');

    // Dynamically populate Year dropdown from activitiesData
    const yearSelect = document.getElementById('dash-filter-year');
    const years = [...new Set(activitiesData.map(a => a.year))].filter(Boolean).sort((a, b) => b - a);
    yearSelect.innerHTML = '<option value="All">All Years</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
}

// Auto-refresh filters
['dash-filter-country', 'dash-filter-province', 'dash-filter-district', 'dash-filter-community', 'dash-filter-year', 'dash-filter-quarter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', updateDashboard);
});

document.getElementById('dash-refresh-btn').addEventListener('click', updateDashboard);

function updateDashboard() {
    const country = document.getElementById('dash-filter-country').value;
    const prov = document.getElementById('dash-filter-province').value;
    const dist = document.getElementById('dash-filter-district').value;
    const commId = document.getElementById('dash-filter-community').value;
    const year = document.getElementById('dash-filter-year').value;
    const quarter = document.getElementById('dash-filter-quarter').value;

    let filteredComms = communitiesData;
    if (country !== 'All') filteredComms = filteredComms.filter(c => c.country === country);
    if (prov !== 'All') filteredComms = filteredComms.filter(c => c.province === prov);
    if (dist !== 'All') filteredComms = filteredComms.filter(c => c.district === dist);
    if (commId !== 'All') filteredComms = filteredComms.filter(c => c.id === commId);

    // Stats
    document.getElementById('dash-stat-communities').innerText = filteredComms.length;
    const avgT0 = filteredComms.length ? (filteredComms.reduce((sum, c) => sum + c.t0_score, 0) / filteredComms.length).toFixed(1) : 0;
    const avgT1 = filteredComms.length ? (filteredComms.reduce((sum, c) => sum + c.t1_score, 0) / filteredComms.length).toFixed(1) : 0;
    document.getElementById('dash-stat-t0').innerText = avgT0;
    document.getElementById('dash-stat-t1').innerText = avgT1;

    // Aggregate Community Demographics
    const aggDemo = { population: 0, male: 0, female: 0, children: 0, elderly: 0 };
    filteredComms.forEach(c => {
        if (c.demographics) {
            aggDemo.population += (c.demographics.population || 0);
            aggDemo.male += (c.demographics.male || 0);
            aggDemo.female += (c.demographics.female || 0);
            aggDemo.children += (c.demographics.children || 0);
            aggDemo.elderly += (c.demographics.elderly || 0);
        }
    });
    document.getElementById('dash-agg-population').innerText = aggDemo.population.toLocaleString();
    document.getElementById('dash-agg-male').innerText = aggDemo.male.toLocaleString();
    document.getElementById('dash-agg-female').innerText = aggDemo.female.toLocaleString();
    document.getElementById('dash-agg-children').innerText = aggDemo.children.toLocaleString();
    document.getElementById('dash-agg-elderly').innerText = aggDemo.elderly.toLocaleString();

    // Beneficiary Aggregation (only from activities matching filters)
    const totals = { men: 0, women: 0, oldMen: 0, oldWomen: 0, newMen: 0, newWomen: 0 };
    activitiesData.forEach(act => {
        // Filter by year/quarter if specified
        if (year !== 'All' && year !== '' && act.year !== year) return;
        if (quarter !== 'All' && act.quarter !== quarter) return;

        const isInFiltered = act.communityIds.some(id => filteredComms.find(fc => fc.id === id));
        if (isInFiltered && act.beneficiaries) {
            Object.keys(totals).forEach(key => {
                totals[key] += (act.beneficiaries[key] || 0);
            });
        }
    });

    renderCharts(totals);
}

function renderCharts(totals) {
    const ctxBar = document.getElementById('reach-chart').getContext('2d');
    const ctxPie = document.getElementById('beneficiary-pie-chart').getContext('2d');

    if (reachChart) reachChart.destroy();
    if (pieChart) pieChart.destroy();

    reachChart = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: ['Men', 'Women', 'Old Men', 'Old Women', 'New Men', 'New Women'],
            datasets: [{
                label: 'Total Reach',
                data: [totals.men, totals.women, totals.oldMen, totals.oldWomen, totals.newMen, totals.newWomen],
                backgroundColor: ['#3b82f6', '#ec4899', '#6366f1', '#f43f5e', '#10b981', '#f59e0b']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    pieChart = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: ['Men', 'Women'],
            datasets: [{
                data: [totals.men + totals.oldMen + totals.newMen, totals.women + totals.oldWomen + totals.newWomen],
                backgroundColor: ['#3b82f6', '#ec4899']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}
