let isAdmin = false;
let currentUserRole = null;

const urlParams = new URLSearchParams(window.location.search);
const isEditMode = urlParams.has('edit') || urlParams.has('admin');

let communitiesData = [];
let activitiesData = [];
let allCommunitiesRaw = [];
let allActivitiesRaw = [];

// Load stored/archived IDs
const archivedCommunityIds = isEditMode ? JSON.parse(localStorage.getItem('archived_communities_v2') || '[]') : [];
const archivedActivityIds = isEditMode ? JSON.parse(localStorage.getItem('archived_activities_v2') || '[]') : [];

async function initData() {
    console.log("Initializing data from Static JS Variables...");

    // 1. Load All Communities from Static JS
    try {
        if (typeof communitiesDataStaticRaw !== 'undefined') {
            const csvText = [communitiesDataStaticRaw.header, ...communitiesDataStaticRaw.data].join('\n');
            const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
            
            if (parsed.data && parsed.data.length) {
                const csvComms = parsed.data.map(row => mapCSVToCommunity(row));
                const savedComms = isEditMode ? JSON.parse(localStorage.getItem('added_communities_v2') || '[]') : [];

                if (isEditMode && savedComms.length > 0) {
                    const savedMap = new Map(savedComms.map(c => [c.id, c]));
                    const conflicts = csvComms.filter(c => savedMap.has(c.id) && !archivedCommunityIds.includes(c.id));

                    if (conflicts.length > 0) {
                        const decisions = await resolveConflicts(conflicts, savedMap);
                        const resolvedMap = new Map();
                        csvComms.forEach(c => resolvedMap.set(c.id, c));
                        decisions.forEach(({ id, keepLocal }) => {
                            if (keepLocal) resolvedMap.set(id, savedMap.get(id));
                        });
                        savedComms.forEach(c => { if (!resolvedMap.has(c.id)) resolvedMap.set(c.id, c); });
                        allCommunitiesRaw = Array.from(resolvedMap.values());
                    } else {
                        const csvMap = new Map(csvComms.map(c => [c.id, c]));
                        savedComms.forEach(c => { if (!csvMap.has(c.id)) csvMap.set(c.id, c); });
                        allCommunitiesRaw = Array.from(csvMap.values());
                    }
                    communitiesData = allCommunitiesRaw.filter(c => !archivedCommunityIds.includes(c.id));
                } else {
                    allCommunitiesRaw = csvComms;
                    communitiesData = allCommunitiesRaw.filter(c => !archivedCommunityIds.includes(c.id));
                }
            }
        } else {
            throw new Error('communitiesDataStaticRaw not found');
        }
    } catch (e) {
        console.error("Critical error loading static communities data.", e);
        allCommunitiesRaw = JSON.parse(localStorage.getItem('added_communities_v2') || '[]');
        communitiesData = allCommunitiesRaw.filter(c => !archivedCommunityIds.includes(c.id));
    }

    // 2. Load Activities from Static JS
    try {
        if (typeof activitiesDataStaticRaw !== 'undefined') {
            const csvText = activitiesDataStaticRaw;
            const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
            if (parsed.data) {
                const acts = parsed.data.map(row => mapCSVToActivity(row));
                const savedActs = isEditMode ? JSON.parse(localStorage.getItem('added_activities_v2') || '[]') : [];
                
                if (isEditMode && savedActs.length > 0) {
                    const actMap = new Map();
                    acts.forEach(i => actMap.set(i.id, i));
                    savedActs.forEach(i => actMap.set(i.id, i));
                    allActivitiesRaw = Array.from(actMap.values());
                    activitiesData = deduplicateById(acts, savedActs, archivedActivityIds);
                } else {
                    allActivitiesRaw = acts;
                    activitiesData = acts.filter(a => !archivedActivityIds.includes(a.id));
                }
            }
        }
    } catch (e) {
        console.error("Error loading static activities data.", e);
    }

    // 3. Load Interventions from Static JS
    try {
        if (typeof interventionsDataStaticRaw !== 'undefined') {
            const csvText = interventionsDataStaticRaw;
            const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
            if (parsed.data) {
                const csvInts = parsed.data.map(row => ({
                    id: row.Id,
                    name: row.Name,
                    coords: [parseFloat(row.Lat), parseFloat(row.Lng)],
                    communityIds: row.CommunityIds ? row.CommunityIds.split(';') : []
                }));
                
                if (isEditMode) {
                    const savedInts = JSON.parse(localStorage.getItem('crmc_interventions_v1') || '[]');
                    const intMap = new Map();
                    csvInts.forEach(i => intMap.set(i.id, i));
                    savedInts.forEach(i => intMap.set(i.id, i));
                    interventionsData = Array.from(intMap.values());
                } else {
                    interventionsData = csvInts;
                }
            }
        }
    } catch (e) {
        console.error("Error loading static interventions data.", e);
    }

    finishInit();
}

function mapCSVToCommunity(row) {
    const comm = {
        id: row.Id,
        name: row.Name,
        country: row.Country,
        province: row.Province,
        district: row.District,
        municipality: row.Municipality || row.Palika || "",
        coords: [parseFloat(row.Lat), parseFloat(row.Lng)],
        t0_score: parseFloat(row.T0_Score) || 0,
        t1_score: "N/A",
        demographics: {
            total: parseInt(row.TotalPop) || 0,
            male: parseInt(row.Male) || 0,
            female: parseInt(row.Female) || 0,
            children: parseInt(row.Children) || 0,
            elderly: parseInt(row.Elderly) || 0,
            disabilities: parseInt(row.Disabilities) || 0,
            hhs: parseInt(row.HHs) || 0,
            description: row.Description
        },
        gradings: {}
    };
    Object.keys(row).forEach(key => {
        if (key.endsWith('_t0')) {
            const indId = key.replace('_t0', '');
            if (!comm.gradings[indId]) comm.gradings[indId] = {};
            comm.gradings[indId].t0 = row[key];
        } else if (key.endsWith('_t1')) {
            const indId = key.replace('_t1', '');
            if (!comm.gradings[indId]) comm.gradings[indId] = {};
            comm.gradings[indId].t1 = "N/A";
        }
    });
    return comm;
}

function mapCSVToActivity(row) {
    return {
        id: row.Id,
        name: row.Name,
        indicatorIds: row.IndicatorIds ? row.IndicatorIds.split(';') : [],
        communityIds: row.CommunityIds ? row.CommunityIds.split(';') : [],
        knowledgeGenerated: row.KnowledgeGenerated === 'true',
        beneficiaries: {
            men: parseInt(row.Men) || 0,
            women: parseInt(row.Women) || 0,
            oldMen: parseInt(row.OldMen) || 0,
            oldWomen: parseInt(row.OldWomen) || 0,
            newMen: parseInt(row.NewMen) || 0,
            newWomen: parseInt(row.NewWomen) || 0
        },
        municipality: row.Municipality || "",
        district: row.District || "",
        province: row.Province || "",
        country: row.Country || ""
    };
}

function deduplicateById(baseItems, savedItems, archivedIds) {
    const map = new Map();
    baseItems.forEach(i => map.set(i.id, i));
    savedItems.forEach(i => map.set(i.id, i));
    return Array.from(map.values()).filter(i => !archivedIds.includes(i.id));
}

/**
 * Shows the conflict resolution modal and returns a Promise that resolves
 * with an array of { id, keepLocal } decisions when the user clicks "Apply Choices".
 */
function resolveConflicts(conflicts, savedMap) {
    return new Promise(resolve => {
        const modal    = document.getElementById('conflict-modal');
        const listEl   = document.getElementById('conflict-list');
        const replaceAllBtn = document.getElementById('conflict-replace-all');
        const keepAllBtn    = document.getElementById('conflict-keep-all');
        const confirmBtn    = document.getElementById('conflict-confirm');

        // Build one row per conflict
        listEl.innerHTML = '';
        conflicts.forEach(csvComm => {
            const localComm = savedMap.get(csvComm.id);
            const row = document.createElement('div');
            row.style.cssText = 'background:white; border:1px solid #e2e8f0; border-radius:10px; padding:14px; display:flex; flex-direction:column; gap:8px;';
            row.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
                    <div>
                        <strong style="color:var(--text-main); font-size:0.95rem;">${csvComm.name}</strong>
                        <span style="font-size:0.75rem; color:var(--text-muted); margin-left:6px;">${csvComm.id}</span>
                    </div>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <span style="font-size:0.75rem; color:var(--text-muted);">Use:</span>
                        <button class="conflict-toggle toggle-btn-small" data-id="${csvComm.id}" data-keep="false"
                            style="background:var(--primary); color:white; border-color:var(--primary);">CSV</button>
                        <button class="conflict-toggle toggle-btn-small" data-id="${csvComm.id}" data-keep="true"
                            style="">Local</button>
                    </div>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:0.8rem;">
                    <div style="background:#eff6ff; padding:8px; border-radius:6px;">
                        <div style="color:var(--primary); font-weight:700; margin-bottom:2px;">📄 CSV Version</div>
                        <div>T0 Score: <strong>${csvComm.t0_score}</strong></div>
                        <div style="color:var(--text-muted);">${csvComm.country} · ${csvComm.demographics?.total?.toLocaleString() || '?'} people</div>
                    </div>
                    <div style="background:#f0fdf4; padding:8px; border-radius:6px;">
                        <div style="color:#16a34a; font-weight:700; margin-bottom:2px;">💾 Local Version</div>
                        <div>T0 Score: <strong>${localComm.t0_score}</strong></div>
                        <div style="color:var(--text-muted);">${localComm.country} · ${localComm.demographics?.total?.toLocaleString() || '?'} people</div>
                    </div>
                </div>
            `;
            listEl.appendChild(row);
        });

        // Toggle button logic (per row)
        function updateToggle(id, keepLocal) {
            listEl.querySelectorAll(`.conflict-toggle[data-id="${id}"]`).forEach(btn => {
                const isActive = btn.dataset.keep === String(keepLocal);
                btn.style.background    = isActive ? (keepLocal ? '#16a34a' : 'var(--primary)') : '';
                btn.style.color         = isActive ? 'white' : '';
                btn.style.borderColor   = isActive ? (keepLocal ? '#16a34a' : 'var(--primary)') : '';
            });
        }

        // Initialise all to "CSV" (keepLocal = false)
        conflicts.forEach(c => updateToggle(c.id, false));

        listEl.addEventListener('click', e => {
            const btn = e.target.closest('.conflict-toggle');
            if (!btn) return;
            const id        = btn.dataset.id;
            const keepLocal = btn.dataset.keep === 'true';
            updateToggle(id, keepLocal);
        });

        // Bulk buttons
        replaceAllBtn.onclick = () => conflicts.forEach(c => updateToggle(c.id, false));
        keepAllBtn.onclick    = () => conflicts.forEach(c => updateToggle(c.id, true));

        // Confirm
        confirmBtn.onclick = () => {
            const decisions = conflicts.map(c => {
                const activeBtn = listEl.querySelector(`.conflict-toggle[data-id="${c.id}"][data-keep="true"]`);
                const keepLocal = activeBtn && activeBtn.style.color === 'white';
                return { id: c.id, keepLocal };
            });
            modal.classList.add('hidden');
            resolve(decisions);
        };

        modal.classList.remove('hidden');
    });
}


// Global state variables
let externalKnowledgeLinks = isEditMode ? JSON.parse(localStorage.getItem('crmc_external_knowledge') || '[]') : [];
const defaultUsers = [{ name: 'admin', pass: '123', role: 'KRO' }];
let usersData = isEditMode ? JSON.parse(localStorage.getItem('crmc_users') || JSON.stringify(defaultUsers)) : defaultUsers;
let indicatorsData;
let countriesData = [];
const savedCountries = isEditMode ? JSON.parse(localStorage.getItem('added_countries_v3') || '[]') : [];

// Interventions State
let interventionsData = isEditMode ? JSON.parse(localStorage.getItem('crmc_interventions_v1') || '[]') : [];

function saveInterventionsToStorage() {
    localStorage.setItem('crmc_interventions_v1', JSON.stringify(interventionsData));
}

let map;
let osm;
let markersGroup;
let interventionsGroup;
const communityMarkers = {};

// UI Handles
let sidebar, showBtn, hideBtn;
let communitySelect;
let loginBtn, logoutBtn, manageActivitiesBtn, archivedCommunitiesBtn, loginModal, addCommModal, manageActModal, manageUsersModal, manageIndModal, archiveModal, adminNameInput, adminPasswordInput, loginError, manageUsersBtn, manageIndBtn, manageCommunitiesBtn, manageKnowledgeBtn, manageCountriesBtn, manageCommModal, manageKnowledgeModal, manageCountriesModal, manageInterventionsBtn, manageInterventionsModal, adminDropdownDiv;
let allScoresBtn, allScoresModal, closeAllScoresModal, allScoresCountrySelect, allScoresGrid;


// Initialize UI Handles immediately (before async data load)
// This allows top-level event listeners to find their elements.
function setupUIHandles() {
    sidebar = document.getElementById('sidebar');
    showBtn = document.getElementById('show-sidebar-btn');
    hideBtn = document.getElementById('hide-sidebar-btn');

    loginBtn = document.getElementById('admin-login-btn');
    logoutBtn = document.getElementById('admin-logout-btn');
    manageActivitiesBtn = document.getElementById('manage-activities-btn');
    archivedCommunitiesBtn = document.getElementById('archived-communities-btn');
    loginModal = document.getElementById('login-modal');
    addCommModal = document.getElementById('add-community-modal');
    manageActModal = document.getElementById('manage-activities-modal');
    manageUsersModal = document.getElementById('manage-users-modal');
    manageIndModal = document.getElementById('manage-indicators-modal');
    archiveModal = document.getElementById('archive-modal');
    adminNameInput = document.getElementById('admin-username');
    adminPasswordInput = document.getElementById('admin-password');
    loginError = document.getElementById('login-error');
    manageUsersBtn = document.getElementById('manage-users-btn');
    manageIndBtn = document.getElementById('manage-indicators-btn');
    manageCommunitiesBtn = document.getElementById('manage-communities-btn');
    manageKnowledgeBtn = document.getElementById('manage-knowledge-btn');
    manageCountriesBtn = document.getElementById('manage-countries-btn');
    manageCommModal = document.getElementById('manage-communities-modal');
    manageKnowledgeModal = document.getElementById('manage-knowledge-modal');
    manageCountriesModal = document.getElementById('manage-countries-modal');
    manageInterventionsBtn = document.getElementById('manage-interventions-btn');
    manageInterventionsModal = document.getElementById('manage-interventions-modal');
    adminDropdownDiv = document.getElementById('admin-actions-div');

    allScoresBtn = document.getElementById('all-scores-btn');
    allScoresModal = document.getElementById('all-scores-modal');
    closeAllScoresModal = document.getElementById('close-all-scores-modal');
    allScoresCountrySelect = document.getElementById('all-scores-country-select');
    allScoresGrid = document.getElementById('all-scores-grid');

    communitySelect = document.getElementById('community-select');
    
    // Reveal Admin Login button only if in Edit Mode
    if (isEditMode && loginBtn) {
        loginBtn.classList.remove('hidden');
    }
}
setupUIHandles();

function saveCountriesToStorage() {
    const customCountries = countriesData.filter(c => !staticData.countries.some(sc => sc.name === c.name));
    localStorage.setItem('added_countries_v3', JSON.stringify(customCountries));
}

function finishInit() {
    console.log("Finishing initialization...");
    
    // Indicators State
    const storedInds = isEditMode ? localStorage.getItem('crmc_indicators_v4') : null;
    if (storedInds) {
        indicatorsData = JSON.parse(storedInds);
    } else {
        indicatorsData = JSON.parse(JSON.stringify(staticData.indicators));
        if (isEditMode) localStorage.setItem('crmc_indicators_v4', JSON.stringify(indicatorsData));
    }

    // Country State
    countriesData = [...staticData.countries, ...savedCountries];
    
    // Force T1 scores to N/A
    communitiesData.forEach(c => {
        c.t1_score = "N/A";
        Object.keys(c.gradings).forEach(indId => {
            c.gradings[indId].t1 = "N/A";
        });
    });
    
    // Autopopulate countries from communitiesData
    const uniqueCountries = [...new Set(communitiesData.map(c => c.country))].filter(Boolean);
    uniqueCountries.forEach(name => {
        if (!countriesData.some(c => c.name === name)) {
            const comms = communitiesData.filter(c => c.country === name);
            const lat = comms.reduce((sum, c) => sum + c.coords[0], 0) / comms.length;
            const lng = comms.reduce((sum, c) => sum + c.coords[1], 0) / comms.length;
            countriesData.push({ name, center: [lat, lng], zoom: 8 });
        }
    });

    // Map Initialization
    map = L.map('map', {
        zoomControl: true
    }).setView([27.1, 80.8], 10);

    // Google Satellite (Hybrid – includes road/place labels)
    osm = L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; <a href="https://maps.google.com">Google Maps</a>'
    }).addTo(map);
    markersGroup = L.layerGroup().addTo(map);
    interventionsGroup = L.layerGroup(); // Don't add to map initially

    // Initial Rendering
    populateCountrySelect();
    // renderInterventionMarkers(); // Don't show by default
    renderCountryMarkers();
    renderColumn(null, 'main');
    initAccordionToggles();
    initTabs();
    setupMapListeners();
    setupIndicatorFilterListeners();

    if (isEditMode) {
        autoLoginAsAdmin();
    }

    // All Scores Listeners
    if (allScoresBtn) {
        allScoresBtn.addEventListener('click', openAllScoresModal);
    }
    if (closeAllScoresModal) {
        closeAllScoresModal.addEventListener('click', () => allScoresModal.classList.add('hidden'));
    }
    if (allScoresCountrySelect) {
        allScoresCountrySelect.addEventListener('change', renderAllScoresGrid);
    }
    
    // Wire up All Scores Checkboxes dynamically
    const allScoresT0 = document.getElementById('all-scores-t0-check');
    const allScoresT1 = document.getElementById('all-scores-t1-check');
    if (allScoresT0) allScoresT0.addEventListener('change', renderAllScoresGrid);
    if (allScoresT1) allScoresT1.addEventListener('change', renderAllScoresGrid);

    // Quick Activities Button
    const quickActsBtn = document.getElementById('quick-activities-btn');
    if (quickActsBtn) {
        quickActsBtn.addEventListener('click', () => {
            renderManageActivitiesList();
            manageActModal.classList.remove('hidden');
        });
    }
    
    if (!communitySelect) return;
    communitySelect.addEventListener('change', (e) => {
        const val = e.target.value;

        if (isInterMapMode) {
            renderInterventionMarkers();
            return;
        }

        if (val === "All") {
            onCountrySelection('All');
        } else {
            const comm = communitiesData.find(c => c.id === val);
            if (comm) {
                // Sync Country Select
                if (comm.country) {
                    const countrySelect = document.getElementById('country-select');
                    if (countrySelect.value !== comm.country) {
                        countrySelect.value = comm.country;
                        // Skip re-populating community list to avoid resetting selection
                        onCountrySelection(comm.country, false); 
                    }
                }
                if (comm) {
                    renderMarkers(comm.country); // ensure right country markers
                    highlightCommunities([comm.id]);
                    renderColumn(comm, 'main');
                    map.flyTo(comm.coords, 13, { animate: true, duration: 1.5 });
                }
                
                // Highlight marker
                resetHighlights();
                const marker = communityMarkers[comm.id];
                if (marker) {
                    const el = marker.getElement();
                    if (el) el.classList.add('leaflet-marker-highlighted');
                }
                
                // Reset expansion state for new community
                expandedCapitals.clear();
                expandedIndicators.clear();
            }
        }
    });
}

function setupIndicatorFilterListeners() {
    const side = 'main';
    ['flood', 'heat', 'generic'].forEach(type => {
        const el = document.getElementById(`filter-${type}-${side}`);
        if (el) {
            el.addEventListener('change', () => {
                // Re-render current column
                const name = document.getElementById('community-name').innerText;
                const activeComm = communitiesData.find(c => c.name === name) || null;
                renderColumn(activeComm, side);
            });
        }
    });
}

function setupMapListeners() {
    // Click on map for community/intervention addition
    map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        if (isAddingCommunityMode) {
            isAddingCommunityMode = false;
            const prompt = document.getElementById('map-click-prompt');
            if (prompt) {
                prompt.classList.add('hidden');
                prompt.style.display = 'none';
            }
            openAddCommunityForm(lat, lng);
        } else if (isAddingInterventionMode) {
            isAddingInterventionMode = false;
            const prompt = document.getElementById('map-click-prompt');
            if (prompt) {
                prompt.classList.add('hidden');
                prompt.style.display = 'none';
            }
            // Fill coords into the intervention form
            const coordsInput = document.getElementById('intervention-coords-input');
            if (coordsInput) coordsInput.value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            // Re-open the interventions modal
            manageInterventionsModal.classList.remove('hidden');
            document.getElementById('add-intervention-section').classList.remove('hidden');
        }
    });
}


// setupUIHandles was moved to top

// Admin Login Logic
loginBtn.addEventListener('click', () => {
    loginModal.classList.remove('hidden');
    adminPasswordInput.value = '';
    loginError.classList.add('hidden');
    
    const userSelect = document.getElementById('admin-username');
    if (userSelect) {
        userSelect.innerHTML = usersData.map(u => `<option value="${u.name}">${u.name} (${u.role})</option>`).join('');
    }
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
        document.getElementById('add-community-btn-dropdown')?.classList.remove('hidden');
        document.getElementById('add-activity-btn-dropdown')?.classList.remove('hidden');
        
        // Role-Based Add Button in Manager
        if (currentUserRole === 'KRO') {
            const addCommBtn = document.getElementById('trigger-map-add-btn');
            if (addCommBtn) addCommBtn.classList.remove('hidden');
        } else {
            const addCommBtn = document.getElementById('trigger-map-add-btn');
            if (addCommBtn) addCommBtn.classList.add('hidden');
        }

        loginModal.classList.add('hidden');
        document.body.classList.add('admin-mode-active');

        // Show all admin-only actions
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));

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
    
    document.getElementById('add-community-btn-dropdown')?.classList.add('hidden');
    document.getElementById('add-activity-btn-dropdown')?.classList.add('hidden');
    
    // Hide all admin-only actions but keep dropdown visible
    document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));

    document.body.classList.remove('admin-mode-active');
    const badge = document.getElementById('admin-badge');
    if (badge) badge.remove();
    // Re-render current community without edit button
    renderColumn(null, 'main');
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
    document.getElementById('new-comm-municipality').value = community.municipality || '';
    document.getElementById('new-comm-district').value = community.district || '';
    document.getElementById('new-comm-province').value = community.province || '';
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
    // Note: T1 score is not pre-filled — it will be added manually later

    // Pre-fill Gradings (T0 only — T1 will be added manually later)
    if (community.gradings) {
        Object.entries(community.gradings).forEach(([indId, grades]) => {
            const t0sel = document.querySelector(`.grading-input[data-indicator="${indId}"][data-type="t0"]`);
            if (t0sel) t0sel.value = grades.t0;
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
                    <select class="grading-input" data-indicator="${ind.id}" data-type="t0" title="T0 Baseline">
                        <option value="D">D</option>
                        <option value="C">C</option>
                        <option value="B">B</option>
                        <option value="A">A</option>
                    </select>
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
    const municipality = document.getElementById('new-comm-municipality').value.trim();
    if (!name) return alert('Please enter a community name.');

    const coordsStr = document.getElementById('new-comm-coords').value.trim();
    if (!coordsStr) return alert('Please set coordinates (click map or type manually).');
    const parts = coordsStr.split(',');
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    if (isNaN(lat) || isNaN(lng)) return alert('Invalid coordinates. Use format: lat, lng');

    // Build gradings: start from existing T1 data (if editing) and overwrite T0 from form
    const editIdForGradings = document.getElementById('edit-comm-id').value;
    const existingComm = editIdForGradings ? communitiesData.find(c => c.id === editIdForGradings) : null;
    const gradings = existingComm ? JSON.parse(JSON.stringify(existingComm.gradings || {})) : {};
    document.querySelectorAll('.grading-input').forEach(sel => {
        const indId = sel.dataset.indicator;
        const type = sel.dataset.type; // only 't0' selects exist now
        if (!gradings[indId]) gradings[indId] = {};
        gradings[indId][type] = sel.value;
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
        name,
        municipality,
        district: document.getElementById('new-comm-district').value,
        province: document.getElementById('new-comm-province').value,
        country: document.getElementById('new-comm-country').value,
        coords: [lat, lng],
        t0_score: parseInt(document.getElementById('new-score-t0').value) || 0,
        t1_score: (isEdit && communitiesData.find(c => c.id === editId)) ? (communitiesData.find(c => c.id === editId).t1_score || 0) : 0,
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


// Sidebar Core Toggle
hideBtn.addEventListener('click', () => {
    sidebar.classList.add('hidden');
    showBtn.classList.remove('hidden');
});

showBtn.addEventListener('click', () => {
    sidebar.classList.remove('hidden');
    showBtn.classList.add('hidden');
});

// Admin Actions Dropdown Toggle
if (adminDropdownDiv) {
    const trigger = adminDropdownDiv.querySelector('.dropdown-trigger');
    if (trigger) {
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            adminDropdownDiv.classList.toggle('show');
        });
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!adminDropdownDiv.contains(e.target)) {
            adminDropdownDiv.classList.remove('show');
        }
    });
}

function autoLoginAsAdmin() {
    const adminUser = usersData.find(u => u.name === 'admin' && u.role === 'KRO');
    if (adminUser) {
        isAdmin = true;
        currentUserRole = adminUser.role;
        loginBtn.classList.add('hidden');
        if (adminDropdownDiv) adminDropdownDiv.classList.remove('hidden');
        document.getElementById('add-community-btn-dropdown')?.classList.remove('hidden');
        document.getElementById('add-activity-btn-dropdown')?.classList.remove('hidden');
        document.getElementById('trigger-map-add-btn')?.classList.remove('hidden');
        document.body.classList.add('admin-mode-active');
        
        const existingBadge = document.getElementById('admin-badge');
        if (!existingBadge) {
            const badge = document.createElement('div');
            badge.id = 'admin-badge';
            badge.className = 'admin-badge';
            badge.innerText = `Admin Mode: ${adminUser.name} (${adminUser.role})`;
            document.body.appendChild(badge);
        }
    }
}

function openAllScoresModal() {
    allScoresModal.classList.remove('hidden');
    populateAllScoresCountrySelect();
    renderAllScoresGrid();
}

function populateAllScoresCountrySelect() {
    const countries = [...new Set(communitiesData.map(c => c.country))].filter(Boolean).sort();
    const currentVal = allScoresCountrySelect.value;
    allScoresCountrySelect.innerHTML = '<option value="All">All Countries</option>' + 
        countries.map(c => `<option value="${c}">${c}</option>`).join('');
    if (countries.includes(currentVal)) allScoresCountrySelect.value = currentVal;
}

function renderAllScoresGrid() {
    const selectedCountry = allScoresCountrySelect.value;
    const showT0 = document.getElementById('all-scores-t0-check')?.checked ?? true;
    const showT1 = document.getElementById('all-scores-t1-check')?.checked ?? false;
    
    allScoresGrid.innerHTML = '';
    
    const filtered = selectedCountry === 'All' 
        ? communitiesData 
        : communitiesData.filter(c => c.country === selectedCountry);

    filtered.forEach(comm => {
        const t0val = comm.t0_score || 0;
        const t1val = comm.t1_score;

        const card = document.createElement('div');
        card.className = 'score-card';
        card.innerHTML = `
            <h3>${comm.name}</h3>
            ${!showT0 && !showT1 ? '<p style="text-align:center; padding: 20px 0; color: #94a3b8;">No data selected</p>' : `
            <div class="score-card-gauge-wrapper">
                <canvas id="gauge-combined-${comm.id}" class="score-card-canvas-large" width="180" height="100"></canvas>
                <div class="score-card-legend">
                    ${showT0 ? `<span style="color:#94a3b8">● T0: ${t0val}</span>` : ''}
                    ${showT1 ? `<span style="color:#2563eb">● T1: ${t1val || 'N/A'}</span>` : ''}
                </div>
            </div>
            `}
        `;
        allScoresGrid.appendChild(card);
        
        if (showT0 || showT1) {
            setTimeout(() => {
                drawCombinedGauge(`gauge-combined-${comm.id}`, showT0 ? t0val : null, showT1 ? t1val : null);
            }, 0);
        }
    });
}

function drawCombinedGauge(canvasId, t0, t1) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = canvas.width / 2, cy = canvas.height - 15, r = 70;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Background arc
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 0);
    ctx.lineWidth = 15; ctx.strokeStyle = '#f1f5f9'; ctx.stroke();

    // T0 Needle (Gray) - only if t0 is not null
    if (t0 !== null && t0 !== undefined) {
        drawNeedle(ctx, cx, cy, r - 8, (t0 / 100) * Math.PI, '#94a3b8');
    }
    
    // T1 Needle (Blue) - only if t1 is not null/undefined
    if (t1 !== null && t1 !== undefined && t1 !== "") {
        drawNeedle(ctx, cx, cy, r, (parseFloat(t1) / 100) * Math.PI, '#2563eb');
    }
}

function drawSimpleGauge(canvasId, value, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = canvas.width / 2, cy = canvas.height - 10, r = 50;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Background arc
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 0);
    ctx.lineWidth = 12; ctx.strokeStyle = '#f1f5f9'; ctx.stroke();

    // Needle
    drawNeedle(ctx, cx, cy, r - 5, (value / 100) * Math.PI, color);
}

// Marker Logic
// markersGroup is initialized in finishInit

function renderCountryMarkers() {
    markersGroup.clearLayers();
    Object.keys(communityMarkers).forEach(k => delete communityMarkers[k]);

    countriesData.forEach(country => {
        const countryCommCount = communitiesData.filter(c => c.country === country.name).length;
        
        // Create a custom icon for country markers
        const countryIcon = L.divIcon({
            className: 'country-marker-icon',
            html: `<div class="country-badge">
                     <span class="country-name">${country.name}</span>
                     <span class="comm-count">${countryCommCount}</span>
                   </div>`,
            iconSize: [60, 40],
            iconAnchor: [30, 20]
        });

        const marker = L.marker(country.center, { icon: countryIcon });
        marker.on('click', () => {
            onCountrySelection(country.name);
        });
        markersGroup.addLayer(marker);
    });

    if (countriesData.length > 0) {
        const bounds = L.latLngBounds(countriesData.map(c => c.center));
        map.fitBounds(bounds, { padding: [100, 100], maxZoom: 6 });
    }
}

function onCountrySelection(countryName, repopulateCommunities = true) {
    const select = document.getElementById('country-select');
    if (select) select.value = countryName;
    
    if (repopulateCommunities) {
        populateCommunitySelect(countryName);
    }

    if (isInterMapMode) {
        renderInterventionMarkers();
        return;
    }

    if (countryName === "All") {
        renderCountryMarkers();
        resetHighlights();
        renderColumn(null, 'main');
    } else {
        renderMarkers(countryName);
        resetHighlights();
        const country = countriesData.find(c => c.name === countryName);
        if (country && repopulateCommunities) {
            map.flyTo(country.center, country.zoom || 8, { animate: true, duration: 1.5 });
        }
    }
}

function renderMarkers(countryFilter = "All") {
    if (countryFilter === "All") {
        renderCountryMarkers();
        return;
    }

    markersGroup.clearLayers();
    Object.keys(communityMarkers).forEach(k => delete communityMarkers[k]);

    const filteredComms = communitiesData.filter(c => c.country === countryFilter);

    filteredComms.forEach(community => {
        const marker = L.marker(community.coords);
        marker.on('click', () => {
            resetHighlights();
            renderColumn(community, 'main');
            sidebar.classList.remove('hidden');
            showBtn.classList.add('hidden');
        });
        markersGroup.addLayer(marker);
        communityMarkers[community.id] = marker;
    });

    if (filteredComms.length > 0) {
        const bounds = L.latLngBounds(filteredComms.map(c => c.coords));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
    }
}

// Initial Map Load (handled in finishInit)

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
    onCountrySelection(e.target.value);
});

function populateCountrySelect() {
    const selects = [
        document.getElementById('country-select'),
        document.getElementById('new-comm-country'),
        document.getElementById('dash-filter-country')
    ];

    selects.forEach(sel => {
        if (!sel) return;
        const isFilter = sel.id === 'country-select' || sel.id === 'dash-filter-country';
        let html = isFilter ? '<option value="All">All Countries</option>' : '';
        countriesData.forEach(c => {
            html += `<option value="${c.name}">${c.name}</option>`;
        });
        sel.innerHTML = html;
    });

    // Also populate community select for the current initial country
    const country = document.getElementById('country-select').value;
    populateCommunitySelect(country);
}

function populateCommunitySelect(countryFilter = "All") {
    if (!communitySelect) return;
    
    let filtered = communitiesData;
    if (countryFilter !== "All") {
        filtered = communitiesData.filter(c => c.country === countryFilter);
    }

    let html = '<option value="All">All Communities</option>';
    filtered.sort((a,b) => a.name.localeCompare(b.name)).forEach(c => {
        html += `<option value="${c.id}">${c.name}</option>`;
    });
    communitySelect.innerHTML = html;
}

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

// State
let needleAngles = { main: { t0: 0, t1: 0 } };
let animFrames = { main: null };
let accordionState = { main: true };
let expandedCapitals = new Set();
let expandedIndicators = new Set();

// Accordion Toggle Listeners
function initAccordionToggles() {
    const side = 'main';
    const btn = document.getElementById(`accordion-toggle-${side}`);
    if (btn) {
        btn.addEventListener('click', () => {
            accordionState[side] = !accordionState[side];
            btn.innerText = `Accordion: ${accordionState[side] ? 'ON' : 'OFF'}`;
            btn.classList.toggle('active');
        });
    }
}

// Toggle Display Listeners (T0/T1)
const side = 'main';
['t0', 't1'].forEach(type => {
    const el = document.getElementById(`show-${type}-${side}`);
    if (el) {
        el.addEventListener('change', () => {
            // Determine which community is currently active
            const name = document.getElementById('community-name').innerText;
            const activeComm = communitiesData.find(c => c.name === name) || null;
            renderColumn(activeComm, side);
        });
    }
});

function renderColumn(community, colType) {
    const title = community ? community.name : "Global Overview";
    document.getElementById('community-name').innerText = title;
    
    // Sync community select
    if (communitySelect) {
        communitySelect.value = community ? community.id : "All";
    }

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

    const countryFilter = document.getElementById('country-select') ? document.getElementById('country-select').value : 'All';
    renderDemographics(community, 'demographics-text-main');
    renderActivities(community, 'activities-list-main', countryFilter);
    renderKnowledge(community, 'knowledge-list-main');
    renderCapitals(community, 'capitals-container-main', 'main');
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

        const extLinks = externalKnowledgeLinks.filter(l => l.communityIds && l.communityIds.includes(community.id));
        extLinks.forEach(link => {
            const li = document.createElement('li');
            const linkHtml = link.url ? `<br><a href="${link.url}" target="_blank" style="color:var(--primary); font-size:0.8rem;">View Resource</a>` : '';
            li.innerHTML = `<strong>${link.title}</strong><br><small>Added Knowledge</small>${linkHtml}`;
            list.appendChild(li);
        });

        if (list.innerHTML === '') list.innerHTML = '<li class="form-hint">No knowledge resources recorded for this community.</li>';
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
                let existing = uniqueActs.find(x => x.name === a.name);
                if (!existing) {
                    existing = { name: a.name, instances: [] };
                    uniqueActs.push(existing);
                }
                
                filteredCommIds.forEach(id => {
                    const comm = communitiesData.find(c => c.id === id);
                    if (comm) {
                        let inst = existing.instances.find(i => i.commId === id);
                        if (!inst) {
                            inst = {
                                commId: id,
                                commName: comm.name,
                                periods: []
                            };
                            existing.instances.push(inst);
                        }
                        const time = (a.year && a.quarter) ? `${a.year}-Q${a.quarter}` : 'N/A';
                        if (!inst.periods.includes(time)) inst.periods.push(time);
                    }
                });
            }
        });

        uniqueActs.forEach(act => {
            const li = document.createElement('li');
            li.className = 'activity-item-global';
            
            li.innerHTML = `
                <div class="activity-header-global">
                    <div>
                        <strong>${act.name}</strong>
                        <small>Undertaken in ${act.instances.length} communities</small>
                    </div>
                    <span class="chevron">▼</span>
                </div>
                <div class="activity-details-global hidden">
                    <ul class="community-instance-list">
                        ${act.instances.map(inst => `
                            <li>
                                <span>${inst.commName}</span>
                                <small>${inst.periods.sort().join(', ')}</small>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
            
            li.onclick = () => {
                const details = li.querySelector('.activity-details-global');
                const isHidden = details.classList.contains('hidden');
                
                // Collapse all others if needed (optional, following accordion pattern)
                list.querySelectorAll('.activity-details-global').forEach(d => d.classList.add('hidden'));
                list.querySelectorAll('.activity-item-global').forEach(item => item.classList.remove('expanded'));

                if (isHidden) {
                    details.classList.remove('hidden');
                    li.classList.add('expanded');
                    highlightCommunities(act.instances.map(i => i.commId));
                } else {
                    resetHighlights();
                }
            };
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

    const showT0 = document.getElementById(`show-t0-${side}`).checked;
    const showT1 = document.getElementById(`show-t1-${side}`).checked;

    const filterFlood = document.getElementById(`filter-flood-${side}`).checked;
    const filterHeat = document.getElementById(`filter-heat-${side}`).checked;
    const filterGeneric = document.getElementById(`filter-generic-${side}`).checked;

    staticData.capitals.forEach(cap => {
        const capDiv = document.createElement('div');
        capDiv.className = 'capital-item';
        let indList = indicatorsData[cap.id] || [];

        // Check if this capital should be expanded
        const isCapExpanded = expandedCapitals.has(cap.id);
        indList = indList.filter(ind => {
            if (ind.type === "Flood") return filterFlood;
            if (ind.type === "Heat") return filterHeat;
            if (ind.type === "Generic") return filterGeneric;
            return true;
        });

        if (indList.length === 0) return; // Skip capital if no indicators match filter

        let degraded = indList.some(i => {
            const g = community.gradings[i.id];
            return g && g.t1 !== "N/A" && g.t1 > g.t0; // A is best, t1 > t0 signifies degradation
        });
        if (degraded && showT0 && showT1) capDiv.classList.add('capital-degraded');
        capDiv.innerHTML = `<div class="capital-header" style="background: ${cap.color}"><span>${cap.name}</span><span class="chevron">${isCapExpanded ? '▲' : '▼'}</span></div><div class="indicators-list" style="display: ${isCapExpanded ? 'block' : 'none'}"></div>`;
        const list = capDiv.querySelector('.indicators-list');

        indList.forEach(ind => {
            const grad = community.gradings[ind.id];
            const isDeg = grad ? (grad.t1 !== "N/A" && grad.t1 > grad.t0) : false;
            const indDiv = document.createElement('div');
            
            // Apply background color class based on type
            let typeClass = "";
            if (ind.type === "Flood") typeClass = "indicator-flood-bg";
            else if (ind.type === "Heat") typeClass = "indicator-heat-bg";
            else if (ind.type === "Generic") typeClass = "indicator-generic-bg";

            indDiv.className = `indicator-item ${typeClass} ${isDeg && showT0 && showT1 ? 'indicator-degraded' : ''}`;
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
            
            const t0Text = showT0 ? `T0: ${grad ? grad.t0 : 'N/A'}` : '';
            const t1Text = showT1 ? `T1: ${grad ? grad.t1 : 'N/A'}` : '';
            const arrow = (showT0 && showT1) ? ' <span class="arrow">→</span> ' : '';

            const isIndExpanded = expandedIndicators.has(ind.id);
            indDiv.innerHTML = `
                <div class="indicator-header"><span>${ind.name}</span><span class="${isDeg && showT0 && showT1 ? 'grade-degraded' : ''}">${t0Text}${arrow}${t1Text}</span></div>
                <div class="activity-sublist" style="display: ${isIndExpanded ? 'block' : 'none'}"><strong>Contributing Activities:</strong><ul>${relatedHtml}</ul></div>
            `;

            indDiv.onclick = (e) => {
                e.stopPropagation();
                const sub = indDiv.querySelector('.activity-sublist');
                const isNowVisible = sub.style.display !== 'block';

                if (accordionState[side]) {
                    // Accordion: Collapse all other indicators in this capital
                    list.querySelectorAll('.activity-sublist').forEach(s => s.style.display = 'none');
                    // We don't necessarily clear all from the Set because they might be in other capitals
                    // but for pure accordion in one list, it's fine.
                }

                // Toggle current
                if (isNowVisible) {
                    sub.style.display = 'block';
                    expandedIndicators.add(ind.id);
                } else {
                    sub.style.display = 'none';
                    expandedIndicators.delete(ind.id);
                }
            };
            list.appendChild(indDiv);
        });

        capDiv.querySelector('.capital-header').onclick = () => {
            const isNowVisible = list.style.display !== 'block';

            if (accordionState[side]) {
                // Accordion: Collapse all other capitals in this container
                container.querySelectorAll('.indicators-list').forEach(l => {
                    if (l !== list) l.style.display = 'none';
                });
                container.querySelectorAll('.chevron').forEach(c => {
                    if (c !== capDiv.querySelector('.chevron')) c.innerText = '▼';
                });
                expandedCapitals.clear(); // Clear all if accordion is ON
            }

            // Toggle current
            if (isNowVisible) {
                list.style.display = 'block';
                capDiv.querySelector('.chevron').innerText = '▲';
                expandedCapitals.add(cap.id);
            } else {
                list.style.display = 'none';
                capDiv.querySelector('.chevron').innerText = '▼';
                expandedCapitals.delete(cap.id);
            }
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
                <button class="toggle-btn-small danger-small" onclick="archiveCommunity('${c.id}')">Archive</button>
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

window.archiveCommunity = function(id) {
    if (!confirm('Are you sure you want to archive this community?')) return;
    if (!archivedCommunityIds.includes(id)) {
        archivedCommunityIds.push(id);
        localStorage.setItem('archived_communities_v2', JSON.stringify(archivedCommunityIds));
    }
    communitiesData = communitiesData.filter(c => c.id !== id);
    renderManageCommunitiesList();
    renderMarkers(document.getElementById('country-select') ? document.getElementById('country-select').value : 'All');
    populateCompareDropdown();
    renderColumn(null, 'main');
};

function renderManageActivitiesList() {
    const listEl = document.getElementById('manage-activities-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    
    // Sort activities by name
    const sorted = [...activitiesData].sort((a,b) => a.name.localeCompare(b.name));
    
    sorted.forEach(act => {
        const item = document.createElement('div');
        item.className = 'manage-act-item';
        item.innerHTML = `
            <div>
                <strong>${act.name}</strong>
                <small>${act.year} - ${act.quarter} | Indicators: ${act.indicatorIds.length} | Targets: ${act.targetEntities ? act.targetEntities.length : act.communityIds.length}</small>
            </div>
        `;
        listEl.appendChild(item);
    });
}
// ===== END OF ACTIVITIES =====

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

function updateArchiveTabStyles() {
    document.getElementById('archive-tab-comm').classList.toggle('active', archiveCurrentTab === 'comm');
}

function openArchiveModal() {
    updateArchiveTabStyles();
    renderArchiveList();
    if (archiveModal) {
        archiveModal.classList.remove('hidden');
    }
}

function renderArchiveList() {
    const listEl = document.getElementById('archive-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    renderArchivedCommunities(listEl);
}

function renderArchivedCommunities(listEl) {
    if (archivedCommunityIds.length === 0) {
        listEl.innerHTML = '<p class="form-hint" style="text-align:center;">No archived communities.</p>';
        return;
    }
    
    const allKnown = [...communities, ...JSON.parse(localStorage.getItem('added_communities_v2') || '[]')];
    
    archivedCommunityIds.forEach(id => {
        const c = allCommunitiesRaw.find(x => x.id === id);
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
        const a = allActivitiesRaw.find(x => x.id === id);
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
            const typeLabel = ind.type ? `<small style="margin-left:8px; opacity:0.6;">(${ind.type})</small>` : '';
            item.innerHTML = `
                <div>${ind.name} ${typeLabel}</div>
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
    document.getElementById('ind-type-input').value = ind.type || 'Generic';
    document.getElementById('ind-capital-input').disabled = false; // Allow changing capital
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
    const type = document.getElementById('ind-type-input').value;
    const editId = document.getElementById('ind-edit-id').value;

    if (!name) return alert('Indicator name is required.');

    if (editId) {
        // Find existing indicator and its current capital
        let oldCapId = null;
        let indObj = null;
        for (const cid in indicatorsData) {
            const idx = indicatorsData[cid].findIndex(i => i.id === editId);
            if (idx !== -1) {
                oldCapId = cid;
                indObj = indicatorsData[cid][idx];
                break;
            }
        }

        if (indObj) {
            indObj.name = name;
            indObj.type = type;

            if (oldCapId !== capId) {
                // Move indicator to new capital
                indicatorsData[oldCapId] = indicatorsData[oldCapId].filter(i => i.id !== editId);
                if (!indicatorsData[capId]) indicatorsData[capId] = [];
                indicatorsData[capId].push(indObj);
            }
        }
    } else {
        // Add new
        const newInd = { id: 'ind_' + Date.now(), name: name, type: type };
        if (!indicatorsData[capId]) indicatorsData[capId] = [];
        indicatorsData[capId].push(newInd);
    }
    
    localStorage.setItem('crmc_indicators_v4', JSON.stringify(indicatorsData));
    
    clearIndForm();
    renderIndicatorsList();
    renderColumn(null, 'main'); // Refresh the view if currently open
    alert(editId ? 'Indicator updated!' : 'Indicator added!');
});

window.deleteIndicator = function(capId, indId) {
    if (!confirm('Are you sure you want to remove this indicator? Data already assigned to this indicator in communities will persist but the indicator name may show as N/A.')) return;
    
    indicatorsData[capId] = indicatorsData[capId].filter(i => i.id !== indId);
    localStorage.setItem('crmc_indicators_v4', JSON.stringify(indicatorsData));
    
    renderIndicatorsList();
};

// ===== COUNTRY MANAGEMENT =====
manageCountriesBtn.addEventListener('click', () => {
    clearCountryForm();
    renderCountriesList();
    manageCountriesModal.classList.remove('hidden');
});

document.getElementById('close-countries-modal').addEventListener('click', () => {
    manageCountriesModal.classList.add('hidden');
});

document.getElementById('show-add-country-btn').addEventListener('click', () => {
    document.getElementById('add-country-section').classList.remove('hidden');
});

document.getElementById('hide-add-country-btn').addEventListener('click', () => {
    document.getElementById('add-country-section').classList.add('hidden');
    clearCountryForm();
});

function renderCountriesList() {
    const listEl = document.getElementById('manage-countries-list');
    listEl.innerHTML = '';
    
    countriesData.forEach(country => {
        const item = document.createElement('div');
        item.className = 'manage-act-item';
        const isStatic = staticData.countries.some(sc => sc.name === country.name);
        
        item.innerHTML = `
            <div>
                <strong>${country.name}</strong>
                <small>${country.center.join(', ')} (Zoom: ${country.zoom})</small>
            </div>
            <div style="display:flex; gap:8px;">
                <button class="toggle-btn-small" onclick="editCountryInModal('${country.name}')">Edit</button>
                ${!isStatic ? `<button class="toggle-btn-small danger-small" onclick="deleteCountry('${country.name}')">Remove</button>` : ''}
            </div>
        `;
        listEl.appendChild(item);
    });
}

window.editCountryInModal = function(name) {
    const country = countriesData.find(c => c.name === name);
    if (!country) return;
    
    document.getElementById('country-edit-id').value = country.name;
    document.getElementById('country-name-input').value = country.name;
    document.getElementById('country-coords-input').value = country.center.join(', ');
    document.getElementById('country-zoom-input').value = country.zoom || 7;
    document.getElementById('add-country-section').classList.remove('hidden');
};

document.getElementById('clear-country-form-btn').addEventListener('click', () => {
    clearCountryForm();
});

function clearCountryForm() {
    document.getElementById('country-edit-id').value = '';
    document.getElementById('country-name-input').value = '';
    document.getElementById('country-coords-input').value = '';
    document.getElementById('country-zoom-input').value = 7;
}

document.getElementById('save-country-btn').addEventListener('click', () => {
    const name = document.getElementById('country-name-input').value.trim();
    const coordsStr = document.getElementById('country-coords-input').value.trim();
    const zoom = parseInt(document.getElementById('country-zoom-input').value) || 7;
    const editId = document.getElementById('country-edit-id').value;

    if (!name || !coordsStr) return alert('Name and coordinates are required.');
    
    const parts = coordsStr.split(',');
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    if (isNaN(lat) || isNaN(lng)) return alert('Invalid coordinates format. Use: lat, lng');

    const countryObj = { name, center: [lat, lng], zoom };

    if (editId) {
        // Edit
        const idx = countriesData.findIndex(c => c.name === editId);
        if (idx !== -1) {
            countriesData[idx] = countryObj;
            if (editId !== name) {
                communitiesData.forEach(comm => {
                    if (comm.country === editId) comm.country = name;
                });
                const savedComms = JSON.parse(localStorage.getItem('added_communities_v2') || '[]');
                savedComms.forEach(c => { if (c.country === editId) c.country = name; });
                localStorage.setItem('added_communities_v2', JSON.stringify(savedComms));
            }
        }
    } else {
        // Add
        if (countriesData.find(c => c.name === name)) return alert('Country already exists.');
        countriesData.push(countryObj);
    }

    saveCountriesToStorage();
    populateCountrySelect();
    renderCountriesList();
    renderCountryMarkers();
    clearCountryForm();
    document.getElementById('add-country-section').classList.add('hidden');
    alert(editId ? 'Country updated!' : 'Country added!');
});

window.deleteCountry = function(name) {
    if (!confirm(`Are you sure you want to remove ${name}?`)) return;
    const used = communitiesData.some(c => c.country === name);
    if (used) return alert(`Cannot delete ${name} because it is assigned to communities.`);
    countriesData = countriesData.filter(c => c.name !== name);
    saveCountriesToStorage();
    populateCountrySelect();
    renderCountriesList();
    renderCountryMarkers();
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
    const muniSelect = document.getElementById('dash-filter-municipality');
    const commSelect = document.getElementById('dash-filter-community');

    // Simple unique extraction
    const provinces = [...new Set(communitiesData.map(c => c.province))].filter(Boolean).sort();
    const districts = [...new Set(communitiesData.map(c => c.district))].filter(Boolean).sort();
    const municipalities = [...new Set(communitiesData.map(c => c.municipality))].filter(Boolean).sort();

    provSelect.innerHTML = '<option value="All">All Provinces</option>' + provinces.map(p => `<option value="${p}">${p}</option>`).join('');
    distSelect.innerHTML = '<option value="All">All Districts</option>' + districts.map(d => `<option value="${d}">${d}</option>`).join('');
    muniSelect.innerHTML = '<option value="All">All Municipalities</option>' + municipalities.map(m => `<option value="${m}">${m}</option>`).join('');
    
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
['dash-filter-country', 'dash-filter-province', 'dash-filter-district', 'dash-filter-municipality', 'dash-filter-community', 'dash-filter-year', 'dash-filter-quarter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', updateDashboard);
});

document.getElementById('dash-refresh-btn').addEventListener('click', updateDashboard);

function updateDashboard() {
    const country = document.getElementById('dash-filter-country').value;
    const prov = document.getElementById('dash-filter-province').value;
    const dist = document.getElementById('dash-filter-district').value;
    const muni = document.getElementById('dash-filter-municipality').value;
    const commId = document.getElementById('dash-filter-community').value;
    const year = document.getElementById('dash-filter-year').value;
    const quarter = document.getElementById('dash-filter-quarter').value;

    let filteredComms = communitiesData;
    if (country !== 'All') filteredComms = filteredComms.filter(c => c.country === country);
    if (prov !== 'All') filteredComms = filteredComms.filter(c => c.province === prov);
    if (dist !== 'All') filteredComms = filteredComms.filter(c => c.district === dist);
    if (muni !== 'All') filteredComms = filteredComms.filter(c => c.municipality === muni);
    if (commId !== 'All') filteredComms = filteredComms.filter(c => c.id === commId);

    const filteredCommIds = new Set(filteredComms.map(c => c.id));

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
            aggDemo.population += (c.demographics.total || 0);
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

    // Beneficiary Aggregation (Multi-Level)
    const totals = { men: 0, women: 0, oldMen: 0, oldWomen: 0, newMen: 0, newWomen: 0 };
    
    activitiesData.forEach(act => {
        // 1. Time Filters
        if (year !== 'All' && year !== '' && act.year !== year) return;
        if (quarter !== 'All' && act.quarter !== quarter) return;

        // 2. Data Migration Support (Handle old activities if any)
        if (!act.targetEntities && act.beneficiaries) {
            // Check if old activity matches geographical filters via communityIds
            const match = (commId === 'All') 
                ? act.communityIds.some(id => filteredCommIds.has(id))
                : act.communityIds.includes(commId);
            
            if (match) {
                totals.men += (act.beneficiaries.men || 0);
                totals.women += (act.beneficiaries.women || 0);
                totals.newMen += (act.beneficiaries.newMen || 0);
                totals.newWomen += (act.beneficiaries.newWomen || 0);
            }
            return;
        }

        // 3. New Multi-Level Logic
        if (!act.targetEntities) return;

        act.targetEntities.forEach(ent => {
            let isMatch = false;

            if (act.level === 'community') {
                // Entity ID is Community ID
                isMatch = filteredCommIds.has(ent.id);
            } else if (act.level === 'municipality') {
                // Entity ID is Municipality Name
                // Match if (muni filter is All OR muni filter == ent.id) 
                // AND (higher level filters match)
                isMatch = (muni === 'All' || muni === ent.id) &&
                          (dist === 'All' || communitiesData.some(c => c.municipality === ent.id && c.district === dist)) &&
                          (prov === 'All' || communitiesData.some(c => c.municipality === ent.id && c.province === prov)) &&
                          (country === 'All' || communitiesData.some(c => c.municipality === ent.id && c.country === country));
            } else if (act.level === 'district') {
                isMatch = (dist === 'All' || dist === ent.id) &&
                          (prov === 'All' || communitiesData.some(c => c.district === ent.id && c.province === prov)) &&
                          (country === 'All' || communitiesData.some(c => c.district === ent.id && c.country === country));
            } else if (act.level === 'province') {
                isMatch = (prov === 'All' || prov === ent.id) &&
                          (country === 'All' || communitiesData.some(c => c.province === ent.id && c.country === country));
            } else if (act.level === 'country') {
                isMatch = (country === 'All' || country === ent.id);
            }

            // Further narrow down if specific muni/comm selected but activity is at higher level
            // Example: If District level activity targets District D, and muni filter is M (where M is in D), match should be TRUE.
            // But if muni filter M is NOT in District D, match should be FALSE.
            if (isMatch) {
                if (muni !== 'All' && act.level === 'district') {
                    isMatch = communitiesData.some(c => c.district === ent.id && c.municipality === muni);
                } else if (commId !== 'All') {
                    // If a specific community is filtered, only count if it's within that target entity
                    const targetComm = communitiesData.find(c => c.id === commId);
                    if (targetComm) {
                        if (act.level === 'municipality') isMatch = (targetComm.municipality === ent.id);
                        if (act.level === 'district') isMatch = (targetComm.district === ent.id);
                        if (act.level === 'province') isMatch = (targetComm.province === ent.id);
                        if (act.level === 'country') isMatch = (targetComm.country === ent.id);
                    } else {
                        isMatch = false;
                    }
                }
            }

            if (isMatch) {
                totals.men += (ent.men || 0);
                totals.women += (ent.women || 0);
                totals.newMen += (ent.newMen || 0);
                totals.newWomen += (ent.newWomen || 0);
            }
        });
    });

    renderCharts(totals);
    updateDashboardTable(totals); // Assuming this helper exists or I'll add it
}

function renderCharts(totals) {
    const ctxBar = document.getElementById('reach-chart').getContext('2d');
    const ctxPie = document.getElementById('beneficiary-pie-chart').getContext('2d');

    if (reachChart) reachChart.destroy();
    if (pieChart) pieChart.destroy();

    const labels = ['Men (Old Participants)', 'Women (Old Participants)', 'Men (New Participants)', 'Women (New Participants)'];
    const dataVals = [totals.men, totals.women, totals.newMen, totals.newWomen];

    reachChart = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Reach (Selected Categories)',
                data: dataVals,
                backgroundColor: ['#3b82f6', '#ec4899', '#10b981', '#f59e0b']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    pieChart = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: ['Men', 'Women'],
            datasets: [{
                data: [totals.men + totals.newMen, totals.women + totals.newWomen],
                backgroundColor: ['#3b82f6', '#ec4899']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function updateDashboardTable(totals) {
    const tableBody = document.getElementById('reach-table-body');
    if (!tableBody) return;

    const labels = ['Men (Old Participants)', 'Women (Old Participants)', 'Men (New Participants)', 'Women (New Participants)'];
    const dataVals = [totals.men, totals.women, totals.newMen, totals.newWomen];

    tableBody.innerHTML = '';
    labels.forEach((lbl, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${lbl}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${dataVals[i].toLocaleString()}</td>
        `;
        tableBody.appendChild(tr);
    });

    const totalReach = totals.newMen + totals.newWomen;
    const trTotal = document.createElement('tr');
    trTotal.innerHTML = `
        <td style="padding: 8px; font-weight: bold; color: var(--primary);">Total Reach (New)</td>
        <td style="padding: 8px; font-weight: bold; color: var(--primary);">${totalReach.toLocaleString()}</td>
    `;
    tableBody.appendChild(trTotal);
}

// Reach Toggle Button
const toggleReachBtn = document.getElementById('toggle-reach-view-btn');
if (toggleReachBtn) {
    toggleReachBtn.addEventListener('click', (e) => {
        const chartContainer = document.getElementById('reach-chart-container');
        const tableContainer = document.getElementById('reach-table-container');
        if (chartContainer.classList.contains('hidden')) {
            chartContainer.classList.remove('hidden');
            tableContainer.classList.add('hidden');
            e.target.innerText = 'Show Table';
        } else {
            chartContainer.classList.add('hidden');
            tableContainer.classList.remove('hidden');
            e.target.innerText = 'Show Chart';
        }
    });
}


// ===== DATA IMPORT =====

document.getElementById('import-data-btn').addEventListener('click', () => {
    document.getElementById('import-data-file').click();
});

document.getElementById('import-data-file').addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    if (!confirm('This will update your data with the selected CSV files. Are you sure?')) {
        e.target.value = '';
        return;
    }

    let loadedCount = 0;
    files.forEach(file => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                const data = results.data;
                if (!data || !data.length) return;

                // Determine if it's an activities file or communities file
                if (file.name.toLowerCase().includes('activities')) {
                    // Import Activities
                    const importedActs = data.map(row => mapCSVToActivity(row));
                    
                    // Merge with existing activities (update existing by Id, add new)
                    const savedActs = JSON.parse(localStorage.getItem('added_activities_v2') || '[]');
                    const actMap = new Map(savedActs.map(a => [a.id, a]));
                    importedActs.forEach(a => actMap.set(a.id, a));
                    localStorage.setItem('added_activities_v2', JSON.stringify(Array.from(actMap.values())));
                } else {
                    // Import Communities
                    const importedComms = data.map(row => mapCSVToCommunity(row));

                    // Merge with existing communities
                    // Strategy: Match by Id OR Name
                    const savedComms = JSON.parse(localStorage.getItem('added_communities_v2') || '[]');
                    
                    importedComms.forEach(imported => {
                        let existingIndex = savedComms.findIndex(c => c.id === imported.id || c.name.toLowerCase() === imported.name.toLowerCase());
                        if (existingIndex !== -1) {
                            // Update existing (merge gradings if needed, or just overwrite with the newer CSV data)
                            savedComms[existingIndex] = imported;
                        } else {
                            // Add as new
                            savedComms.push(imported);
                        }
                    });
                    
                    localStorage.setItem('added_communities_v2', JSON.stringify(savedComms));
                }

                loadedCount++;
                if (loadedCount === files.length) {
                    alert('All data imported successfully! The page will now reload.');
                    window.location.reload();
                }
            },
            error: function(err) {
                alert('Error parsing CSV: ' + err.message);
            }
        });
    });
});

// ===== UI TOGGLES FOR ADD FORMS =====

const setupFormToggle = (showBtnId, hideBtnId, sectionId) => {
    const showBtn = document.getElementById(showBtnId);
    const hideBtn = document.getElementById(hideBtnId);
    const section = document.getElementById(sectionId);
    
    if (showBtn && hideBtn && section) {
        showBtn.addEventListener('click', () => section.classList.remove('hidden'));
        hideBtn.addEventListener('click', () => section.classList.add('hidden'));
    }
};

setupFormToggle('show-add-activity-btn', 'hide-add-activity-btn', 'add-activity-section');
setupFormToggle('show-add-user-btn', 'hide-add-user-btn', 'add-user-section');
setupFormToggle('show-add-indicator-btn', 'hide-add-indicator-btn', 'add-indicator-section');

// Register new dropdown add buttons
document.getElementById('add-community-btn-dropdown')?.addEventListener('click', () => {
    isAddingCommunityMode = true;
    const promptText = document.getElementById('map-click-prompt-text');
    if (promptText) promptText.textContent = 'Please click on the map to set the location for the new community.';
    const prompt = document.getElementById('map-click-prompt');
    if (prompt) {
        prompt.classList.remove('hidden');
        prompt.style.display = 'flex';
    }
});
document.getElementById('add-activity-btn-dropdown')?.addEventListener('click', () => {
    manageActModal.classList.remove('hidden');
    document.getElementById('add-activity-section').classList.remove('hidden');
});

// ===== COMMUNITY ADDITION FLOW (FROM MODAL) =====
let isAddingCommunityMode = false;
let isAddingInterventionMode = false;
let isInterMapMode = false;

// map logic moved to setupMapListeners

// Manage Communities "Add New" Button
document.getElementById('trigger-map-add-btn')?.addEventListener('click', () => {
    manageCommModal.classList.add('hidden');
    isAddingCommunityMode = true;
    const promptText = document.getElementById('map-click-prompt-text');
    if (promptText) promptText.textContent = 'Please click on the map to set the location for the new community.';
    const prompt = document.getElementById('map-click-prompt');
    if (prompt) {
        prompt.classList.remove('hidden');
        prompt.style.display = 'flex';
    }
});

// Cancel Map Click Mode
document.getElementById('cancel-map-click-btn')?.addEventListener('click', () => {
    if (isAddingInterventionMode) {
        isAddingInterventionMode = false;
        manageInterventionsModal.classList.remove('hidden');
    } else {
        isAddingCommunityMode = false;
        openManageCommunitiesModal();
    }
    const prompt = document.getElementById('map-click-prompt');
    if (prompt) {
        prompt.classList.add('hidden');
        prompt.style.display = 'none';
    }
});

// ===== INTERVENTION MANAGEMENT =====
let interventionMarkers = {}; // Global dictionary to reference marker objects

function renderInterventionMarkers() {
    if (!interventionsGroup) return;
    interventionsGroup.clearLayers();

    const countryVal = document.getElementById('country-select') ? document.getElementById('country-select').value : 'All';
    const commVal = document.getElementById('community-select') ? document.getElementById('community-select').value : 'All';

    let filtered = interventionsData;

    if (commVal !== "All") {
        filtered = filtered.filter(i => i.communityIds && i.communityIds.includes(commVal));
    } else if (countryVal !== "All") {
        const commIdsInCountry = new Set(communitiesData.filter(c => c.country === countryVal).map(c => c.id));
        filtered = filtered.filter(i => i.communityIds && i.communityIds.some(cid => commIdsInCountry.has(cid)));
    }

    const categoryColors = {
        'Flood Management': '#3b82f6',
        'Heatwave Response': '#ef4444',
        'Community Training': '#10b981',
        'Infrastructure': '#8b5cf6',
        'Early Warning': '#f59e0b',
        'Livelihood Support': '#06b6d4',
        'Other': '#6b7280'
    };

    interventionMarkers = {}; // Clear old dictionary
    
    filtered.forEach(intervention => {
        if (!intervention.coords || isNaN(intervention.coords[0])) return;
        const color = (intervention.category && categoryColors[intervention.category]) ? categoryColors[intervention.category] : '#d97706';
        const icon = L.divIcon({
            className: 'intervention-marker-icon',
            html: `<div class="intervention-pin" style="--pin-color:${color};" title="${intervention.name}">
                     <span class="intervention-pin-label">${intervention.name.length > 14 ? intervention.name.slice(0,13)+'…' : intervention.name}</span>
                   </div>`,
            iconSize: [32, 42],
            iconAnchor: [16, 42],
            popupAnchor: [0, -44]
        });

        const marker = L.marker(intervention.coords, { icon });
        const catBadge = intervention.category ? `<span style="font-size:0.72rem;background:${color};color:white;padding:2px 7px;border-radius:20px;display:inline-block;margin-bottom:8px;">${intervention.category}</span>` : '';
        
        const popupContent = `
            <div style="font-family: 'Inter', sans-serif; min-width: 200px; padding-right: 5px;">
                <h4 style="margin: 0 0 5px 0; color: var(--primary); font-size: 1rem;">${intervention.name}</h4>
                ${catBadge}
                <div style="font-size: 0.85rem; color: var(--text-muted); max-height: 150px; overflow-y: auto; line-height: 1.4;">
                    ${intervention.description ? intervention.description.replace(/\n/g, '<br>') : '<em>No summary available.</em>'}
                </div>
                ${isAdmin ? `
                <div style="margin-top: 15px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
                    <button class="toggle-btn-small" onclick="editInterventionInModal('${intervention.id}')" style="width:100%; margin:0;">✏️ Edit</button>
                </div>
                ` : ''}
            </div>
        `;
        
        marker.bindPopup(popupContent, { offset: [0, -35] });
        
        marker.on('click', () => {           
            interventionsGroup.eachLayer(layer => {
                const el = layer.getElement();
                if (el) el.classList.remove('leaflet-marker-highlighted');
            });
            const el = marker.getElement();
            if (el) el.classList.add('leaflet-marker-highlighted');
        });
        
        interventionsGroup.addLayer(marker);
        interventionMarkers[intervention.id] = marker; // Store mapping
    });

    const validCoords = filtered.filter(i => i.coords && !isNaN(i.coords[0])).map(i => i.coords);
    if (validCoords.length > 0) {
        map.flyToBounds(L.latLngBounds(validCoords), { padding: [50, 50], maxZoom: 12, animate: true, duration: 1.5 });
    }
    
    // Inject all valid interventions into the interactive sidebar list
    renderInterventionSidebarList(filtered);
}

function renderInterventionSidebarList(interventions) {
    const colInt = document.getElementById('col-intervention');
    if (!colInt) return;

    if (interventions.length === 0) {
        colInt.innerHTML = '<div style="padding: 20px; color: var(--text-muted); text-align: center; margin-top: 50px;">No interventions found in this area.</div>';
        return;
    }

    // Ensure main column uses flex logic
    colInt.style.display = 'flex';
    colInt.style.flexDirection = 'column';
    colInt.style.overflow = 'hidden';

    let listHtml = `
        <div class="column-info" style="padding: 20px 20px 10px 20px; border-bottom: 1px solid #e2e8f0; flex-shrink: 0; background: white;">
            <h2 style="margin:0; color: var(--primary);">Interventions (${interventions.length})</h2>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 5px; line-height: 1.3;">Select an intervention to locate it on the map.</p>
        </div>
        <div style="flex: 1; overflow-y: auto; padding: 15px 15px 15px 15px; background: #f8fafc;">
            <div style="display: flex; flex-direction: column; gap: 12px;">
    `;

    const categoryColors = {
        'Flood Management': '#3b82f6',
        'Heatwave Response': '#ef4444',
        'Community Training': '#10b981',
        'Infrastructure': '#8b5cf6',
        'Early Warning': '#f59e0b',
        'Livelihood Support': '#06b6d4',
        'Other': '#6b7280'
    };

    interventions.forEach(inter => {
        const catColor = (inter.category && categoryColors[inter.category]) ? categoryColors[inter.category] : '#d97706';
        
        listHtml += `
            <div class="dash-card sidebar-list-card" style="cursor: pointer; padding: 14px; background: white; border-radius: 12px; transition: transform 0.2s, box-shadow 0.2s;" onclick="zoomToIntervention('${inter.id}')" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 16px rgba(0,0,0,0.06)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 6px rgba(0,0,0,0.04)'">
                <div style="margin-bottom: 8px;">
                    <h4 style="margin: 0; color: var(--text-main); font-size: 0.95rem;">${inter.name}</h4>
                </div>
                ${inter.category ? `<span style="font-size:0.7rem;background:${catColor};color:white;padding:3px 8px;border-radius:12px;font-weight:600;">${inter.category}</span>` : ''}
                <div style="font-size: 0.75rem; color: #64748b; margin-top: 10px;">
                    <i data-lucide="map-pin" style="width: 12px; height: 12px; vertical-align: middle;"></i> 
                    ${inter.coords ? `${inter.coords[0].toFixed(3)}, ${inter.coords[1].toFixed(3)}` : 'No valid coordinates'}
                </div>
            </div>
        `;
    });

    listHtml += `
            </div>
        </div>
    `;

    colInt.innerHTML = listHtml;
    if (window.lucide) window.lucide.createIcons();
}

window.zoomToIntervention = function(id) {
    const inter = interventionsData.find(i => i.id === id);
    if (!inter || !inter.coords) return;
    
    // Zoom and pan smoothly to the exact coordinates
    map.flyTo(inter.coords, 14, { animate: true, duration: 1.5 });
    
    // Open the associated Map Popup directly
    if (interventionMarkers[id]) {
        setTimeout(() => {
            interventionMarkers[id].openPopup();
        }, 300); // slight delay so map adjusts before drawing the bubble
    }
};

// Function showInterventionSidebar was removed as Leaflet tooltips are now used natively.

function clearInterventionForm() {
    document.getElementById('intervention-edit-id').value = '';
    document.getElementById('intervention-name-input').value = '';
    document.getElementById('intervention-coords-input').value = '';
    document.getElementById('intervention-desc-input').value = '';
    document.getElementById('intervention-category-input').value = '';
}

function renderInterventionsList() {
    const listEl = document.getElementById('manage-interventions-list');
    listEl.innerHTML = '';

    if (!interventionsData.length) {
        listEl.innerHTML = '<p class="form-hint" style="text-align:center;padding:20px;">No interventions added yet. Click "+ Add New Intervention" to begin.</p>';
        return;
    }

    const categoryColors = {
        'Flood Management': '#3b82f6',
        'Heatwave Response': '#ef4444',
        'Community Training': '#10b981',
        'Infrastructure': '#8b5cf6',
        'Early Warning': '#f59e0b',
        'Livelihood Support': '#06b6d4',
        'Other': '#6b7280'
    };

    interventionsData.forEach(intervention => {
        const item = document.createElement('div');
        item.className = 'manage-act-item';
        item.style.cssText = 'border-left: 4px solid #f59e0b; margin-bottom: 8px;';
        const color = (intervention.category && categoryColors[intervention.category]) ? categoryColors[intervention.category] : '#d97706';
        const catBadge = intervention.category
            ? `<span style="font-size:0.7rem;background:${color};color:white;padding:2px 7px;border-radius:20px;margin-left:6px;">${intervention.category}</span>`
            : '';
        item.innerHTML = `
            <div style="flex:1;">
                <div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;">
                    <strong style="color:#1e293b;">📍 ${intervention.name}</strong>${catBadge}
                </div>
                <small style="color:var(--text-muted);display:block;margin-top:3px;">
                    ${intervention.coords ? `${intervention.coords[0].toFixed(4)}, ${intervention.coords[1].toFixed(4)}` : 'No coords'}
                    ${intervention.description ? ` — ${intervention.description.length > 60 ? intervention.description.slice(0,60)+'…' : intervention.description}` : ''}
                </small>
            </div>
            <div style="display:flex;gap:8px;flex-shrink:0;">
                <button class="toggle-btn-small" onclick="editInterventionInModal('${intervention.id}')">Edit</button>
                <button class="toggle-btn-small danger-small" onclick="deleteIntervention('${intervention.id}')">Delete</button>
            </div>
        `;
        listEl.appendChild(item);
    });
}

// Open Intervention Map directly
manageInterventionsBtn.addEventListener('click', () => {
    openInterventionMapView();
});

// Close modal
document.getElementById('close-interventions-modal').addEventListener('click', () => {
    manageInterventionsModal.classList.add('hidden');
});

// Show / hide add form
document.getElementById('show-add-intervention-btn').addEventListener('click', () => {
    clearInterventionForm();
    document.getElementById('add-intervention-section').classList.remove('hidden');
});
document.getElementById('hide-add-intervention-btn').addEventListener('click', () => {
    document.getElementById('add-intervention-section').classList.add('hidden');
    clearInterventionForm();
});
document.getElementById('clear-intervention-form-btn').addEventListener('click', clearInterventionForm);

// Pick on Map
document.getElementById('intervention-pick-map-btn').addEventListener('click', () => {
    manageInterventionsModal.classList.add('hidden');
    isAddingInterventionMode = true;
    const promptText = document.getElementById('map-click-prompt-text');
    if (promptText) promptText.textContent = 'Click on the map to set the location for the intervention.';
    const prompt = document.getElementById('map-click-prompt');
    if (prompt) {
        prompt.classList.remove('hidden');
        prompt.style.display = 'flex';
        prompt.style.background = '#d97706';
    }
});

// Save intervention
document.getElementById('save-intervention-btn').addEventListener('click', () => {
    const name = document.getElementById('intervention-name-input').value.trim();
    if (!name) return alert('Please enter an intervention name.');

    const coordsStr = document.getElementById('intervention-coords-input').value.trim();
    if (!coordsStr) return alert('Please enter coordinates or use "Pick on Map".');
    const parts = coordsStr.split(',');
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    if (isNaN(lat) || isNaN(lng)) return alert('Invalid coordinates. Use format: lat, lng');

    const description = document.getElementById('intervention-desc-input').value.trim();
    const category = document.getElementById('intervention-category-input').value;
    const editId = document.getElementById('intervention-edit-id').value;

    const obj = {
        id: editId || ('int_' + Date.now()),
        name,
        coords: [lat, lng],
        description,
        category
    };

    if (editId) {
        const idx = interventionsData.findIndex(i => i.id === editId);
        if (idx !== -1) interventionsData[idx] = obj;
    } else {
        interventionsData.push(obj);
    }

    saveInterventionsToStorage();
    renderInterventionMarkers();
    renderInterventionsList();
    clearInterventionForm();
    document.getElementById('add-intervention-section').classList.add('hidden');
    alert(editId ? 'Intervention updated!' : 'Intervention added!');
});

window.editInterventionInModal = function(id) {
    const intervention = interventionsData.find(i => i.id === id);
    if (!intervention) return;
    document.getElementById('intervention-edit-id').value = intervention.id;
    document.getElementById('intervention-name-input').value = intervention.name;
    document.getElementById('intervention-coords-input').value = intervention.coords ? intervention.coords.join(', ') : '';
    document.getElementById('intervention-desc-input').value = intervention.description || '';
    document.getElementById('intervention-category-input').value = intervention.category || '';
    document.getElementById('add-intervention-section').classList.remove('hidden');
    document.getElementById('add-intervention-section').scrollIntoView({ behavior: 'smooth' });
};

window.deleteIntervention = function(id) {
    const intervention = interventionsData.find(i => i.id === id);
    if (!intervention) return;
    if (!confirm(`Delete intervention "${intervention.name}"? This cannot be undone.`)) return;
    interventionsData = interventionsData.filter(i => i.id !== id);
    saveInterventionsToStorage();
    renderInterventionMarkers();
    renderInterventionsList();
};

// Intervention Map View Toggling
const viewInterMapBtn = document.getElementById('view-intervention-map-btn');
const closeInterMapBtn = document.getElementById('close-inter-map-btn');

if (viewInterMapBtn) {
    viewInterMapBtn.addEventListener('click', openInterventionMapView);
}

if (closeInterMapBtn) {
    closeInterMapBtn.addEventListener('click', closeInterventionMapView);
}

function openInterventionMapView() {
    isInterMapMode = true;
    
    // 1. Manage Layers
    renderInterventionMarkers(); // Ensure markers are created before adding
    if (map.hasLayer(markersGroup)) map.removeLayer(markersGroup);
    if (!map.hasLayer(interventionsGroup)) map.addLayer(interventionsGroup);

    // 2. Manage UI
    manageInterventionsModal.classList.add('hidden');
    sidebar.classList.remove('hidden');
    document.getElementById('col-main').classList.add('hidden');
    
    const colInt = document.getElementById('col-intervention');
    if (colInt) {
        colInt.classList.remove('hidden');
    }

    showBtn.classList.add('hidden');
    closeInterMapBtn.classList.remove('hidden');
}

function closeInterventionMapView() {
    isInterMapMode = false;
    
    // 1. Manage Layers
    if (!map.hasLayer(markersGroup)) map.addLayer(markersGroup);
    if (map.hasLayer(interventionsGroup)) map.removeLayer(interventionsGroup);

    // 2. Manage UI
    sidebar.classList.remove('hidden');
    document.getElementById('col-main').classList.remove('hidden');
    const colInt = document.getElementById('col-intervention');
    if (colInt) colInt.classList.add('hidden');
    
    closeInterMapBtn.classList.add('hidden');

    // 3. Reset View
    const countryName = document.getElementById('country-select').value;
    onCountrySelection(countryName, false);
}

// Universal handler for modal close buttons
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.modal-close-x');
    if (btn) {
        const modal = btn.closest('.modal');
        if (modal) modal.classList.add('hidden');
    }
    
    // Close Quick Actions dropdown when any item is clicked
    if (e.target.closest('.dropdown-item')) {
        const dropdown = e.target.closest('.admin-dropdown');
        if (dropdown) dropdown.classList.remove('show');
    }
});

// Start initialization
initData();
