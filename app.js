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

    // 2.5 Load Knowledge from Static JS
    try {
        if (typeof knowledgeDataStaticRaw !== 'undefined') {
            const csvText = knowledgeDataStaticRaw;
            const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
            if (parsed.data) {
                const csvKnows = parsed.data.map(row => ({
                    id: row.Id,
                    title: row.Title,
                    url: row.Url,
                    communityIds: row.CommunityIds ? row.CommunityIds.split(';') : [],
                    activityIds: row.ActivityIds ? row.ActivityIds.split(';') : [],
                    indicatorIds: row.IndicatorIds ? row.IndicatorIds.split(';') : []
                }));
                
                const savedKnows = isEditMode ? JSON.parse(localStorage.getItem('crmc_external_knowledge') || '[]') : [];
                const knowMap = new Map();
                csvKnows.forEach(k => knowMap.set(k.id, k));
                // Saved ones take precedence
                savedKnows.forEach(k => knowMap.set(k.id, k));
                externalKnowledgeLinks = Array.from(knowMap.values());
            }
        }
    } catch (e) {
        console.error("Error loading static knowledge data.", e);
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
                    communityIds: row.CommunityIds ? row.CommunityIds.split(';') : [],
                    yearsQuarters: row.YearsQuarters ? row.YearsQuarters.split(';') : ['2025-Q1']
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
                
                // Trigger map refresh if interventions view is active
                if (typeof isInterMapMode !== 'undefined' && isInterMapMode) renderInterventionMarkers();
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
        municipality: (() => {
            let m = (row.Municipality || row.Palika || "").trim();
            if (!m && row.Description) {
                const d = row.Description;
                if (d.toLowerCase().includes('palika:')) {
                    m = d.split(/palika:/i)[1].split(',')[0].trim();
                } else if (d.toLowerCase().includes('municipality:')) {
                    m = d.split(/municipality:/i)[1].split(',')[0].trim();
                }
            }
            return m.replace(/Palika/gi, "Municipality").trim();
        })(),
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
        extent: (row.ExtentN && row.ExtentS && row.ExtentE && row.ExtentW) ? {
            n: parseFloat(row.ExtentN),
            s: parseFloat(row.ExtentS),
            e: parseFloat(row.ExtentE),
            w: parseFloat(row.ExtentW)
        } : null,
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
        knowledgeTitle: row.KnowledgeTitle || "",
        yearsQuarters: row.YearsQuarters ? row.YearsQuarters.split(';') : (row.Year && row.Quarter ? [`${row.Year}-Q${row.Quarter.replace('Q','')}`] : ['2025-Q1']),
        description: row.Description || "",
        knowledgeLink: row.KnowledgeLink || "",
        beneficiaries: {
            men: parseInt(row.Men) || 0,
            women: parseInt(row.Women) || 0,
            oldMen: parseInt(row.OldMen) || 0,
            oldWomen: parseInt(row.OldWomen) || 0,
            newMen: parseInt(row.NewMen) || 0,
            newWomen: parseInt(row.NewWomen) || 0
        },
        municipality: (row.Municipality || row.Palika || "").replace(/Palika/gi, "Municipality").trim(),
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
// Global state variables
let externalKnowledgeLinks = [];
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
    if (communitySelect) {
        communitySelect.addEventListener('change', (e) => {
            const cid = e.target.value;
            const comm = cid === 'All' ? null : communitiesData.find(c => c.id === cid);
            renderColumn(comm, 'main');
            if (comm) {
                if (comm.extent) {
                    const bounds = L.latLngBounds([comm.extent.n, comm.extent.w], [comm.extent.s, comm.extent.e]);
                    const padding = getMapPadding();
                    map.flyToBounds(bounds, { animate: true, duration: 1.5, paddingBottomRight: padding, paddingTopLeft: [50, 50] });
                } else {
                    // Original shift-centering logic for single points
                    const zoomLevel = 14;
                    let target = comm.coords;
                    const sb = document.getElementById('sidebar');
                    if (sb && !sb.classList.contains('hidden') && window.innerWidth > 768) {
                        const p = map.project(comm.coords, zoomLevel);
                        target = map.unproject(p.add([200, 0]), zoomLevel);
                    }
                    map.flyTo(target, zoomLevel, { animate: true, duration: 1.5 });
                }
                highlightCommunities([cid], true, true);
            } else {
                resetHighlights();
            }
        });
    }
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
    renderCountryMarkers(false);
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
                    
                    const zoomLevel = 13;
                    let target = comm.coords;
                    const sb = document.getElementById('sidebar');
                    if (sb && !sb.classList.contains('hidden') && window.innerWidth > 768) {
                        const p = map.project(comm.coords, zoomLevel);
                        target = map.unproject(p.add([200, 0]), zoomLevel);
                    }
                    map.flyTo(target, zoomLevel, { animate: true, duration: 1.5 });
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
                const commId = communitySelect ? communitySelect.value : 'All';
                const comm = (commId === 'All') ? null : communitiesData.find(c => c.id === commId);
                renderColumn(comm, side); 
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
    
    // Pre-fill Extent
    if (community.extent) {
        document.getElementById('new-comm-extent-n').value = community.extent.n || '';
        document.getElementById('new-comm-extent-s').value = community.extent.s || '';
        document.getElementById('new-comm-extent-e').value = community.extent.e || '';
        document.getElementById('new-comm-extent-w').value = community.extent.w || '';
    } else {
        document.getElementById('new-comm-extent-n').value = '';
        document.getElementById('new-comm-extent-s').value = '';
        document.getElementById('new-comm-extent-e').value = '';
        document.getElementById('new-comm-extent-w').value = '';
    }

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
        extent: (() => {
            const n = parseFloat(document.getElementById('new-comm-extent-n').value);
            const s = parseFloat(document.getElementById('new-comm-extent-s').value);
            const e = parseFloat(document.getElementById('new-comm-extent-e').value);
            const w = parseFloat(document.getElementById('new-comm-extent-w').value);
            if (!isNaN(n) && !isNaN(s) && !isNaN(e) && !isNaN(w)) {
                return { n, s, e, w };
            }
            return null;
        })(),
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
    
    // Draw 3 segmented intervals (0-33, 33-67, 67-100)
    ctx.lineWidth = 15;
    
    // 0 to 33 (Degraded)
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, Math.PI + (Math.PI * 0.33));
    ctx.strokeStyle = '#fca5a5';
    ctx.stroke();

    // 33 to 67 (Moderate)
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI + (Math.PI * 0.33), Math.PI + (Math.PI * 0.67));
    ctx.strokeStyle = '#fde047';
    ctx.stroke();

    // 67 to 100 (Optimal)
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI + (Math.PI * 0.67), 0);
    ctx.strokeStyle = '#86efac';
    ctx.stroke();

    // Add visual separators for the bounds (33, 67)
    ctx.lineWidth = 17;
    ctx.strokeStyle = '#ffffff';
    [0.33, 0.67].forEach(pct => {
        ctx.beginPath();
        const angle = Math.PI + (Math.PI * pct);
        ctx.arc(cx, cy, r, angle - 0.02, angle + 0.02);
        ctx.stroke();
    });

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

function renderCountryMarkers(animate = true) {
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
            if (typeof isInterMapMode !== 'undefined' && isInterMapMode) closeInterventionMapView();
            const colAct = document.getElementById('col-activities');
            if (colAct && !colAct.classList.contains('hidden')) closeActivitiesSidebarView();
            const colKnow = document.getElementById('col-knowledge');
            if (colKnow && !colKnow.classList.contains('hidden')) closeKnowledgeSidebarView();

            onCountrySelection(country.name);
        });
        markersGroup.addLayer(marker);
    });

    if (countriesData.length > 0) {
        const bounds = L.latLngBounds(countriesData.map(c => c.center));
        const padding = getMapPadding();
        if (animate) {
            map.flyToBounds(bounds, { paddingBottomRight: padding, paddingTopLeft: [100, 100], duration: 2 });
        } else {
            map.fitBounds(bounds, { paddingBottomRight: padding, paddingTopLeft: [100, 100] });
        }
    }
}

function getMapPadding() {
    const sb = document.getElementById('sidebar');
    const isHidden = sb ? sb.classList.contains('hidden') : true;
    if (isHidden) return [50, 50];
    
    const isMobile = window.innerWidth <= 768;
    if (isMobile) return [50, 50]; // Sidebar is bottom-fixed in mobile, usually 
    
    // Desktop: Sidebar on the right is 400px
    return [450, 50]; // 400 sidebar + 50 default padding
}

function onCountrySelection(countryName, repopulateCommunities = true, animate = true) {
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
        renderCountryMarkers(animate);
        resetHighlights();
        renderColumn(null, 'main');
    } else {
        renderMarkers(countryName, animate);
        resetHighlights();
        renderColumn(null, 'main'); // IMPORTANT: Ensure the sidebar layout reflects the country shift instantly
        const country = countriesData.find(c => c.name === countryName);
        if (country && repopulateCommunities) {
            if (animate) {
                map.flyTo(country.center, country.zoom || 8, { animate: true, duration: 1.5 });
            } else {
                map.setView(country.center, country.zoom || 8);
            }
        }
    }
}

function renderMarkers(countryFilter = "All", animate = true) {
    if (countryFilter === "All") {
        renderCountryMarkers(animate);
        return;
    }

    markersGroup.clearLayers();
    Object.keys(communityMarkers).forEach(k => delete communityMarkers[k]);

    const filteredComms = communitiesData.filter(c => c.country === countryFilter);

    filteredComms.forEach(community => {
        const marker = L.marker(community.coords);
        marker.bindTooltip(community.name); // Standard hover
        marker.on('click', () => {
            resetHighlights();
            
            if (typeof isInterMapMode !== 'undefined' && isInterMapMode) closeInterventionMapView();
            const colAct = document.getElementById('col-activities');
            if (colAct && !colAct.classList.contains('hidden')) closeActivitiesSidebarView();
            const colKnow = document.getElementById('col-knowledge');
            if (colKnow && !colKnow.classList.contains('hidden')) closeKnowledgeSidebarView();

            renderColumn(community, 'main');
            sidebar.classList.remove('hidden');
            showBtn.classList.add('hidden');
        });
        markersGroup.addLayer(marker);
        communityMarkers[community.id] = marker;
    });

    if (filteredComms.length > 0) {
        const bounds = L.latLngBounds(filteredComms.map(c => c.coords));
        const padding = getMapPadding();
        if (animate) {
            map.fitBounds(bounds, { paddingBottomRight: padding, paddingTopLeft: [50, 50], maxZoom: 10 });
        } else {
            map.fitBounds(bounds, { paddingBottomRight: padding, paddingTopLeft: [50, 50], maxZoom: 10 });
        }
    }
}

// Initial Map Load (handled in finishInit)

function resetHighlights() {
    Object.keys(communityMarkers).forEach(id => {
        const m = communityMarkers[id];
        const icon = m.getElement();
        if (icon) {
            icon.classList.remove('leaflet-marker-highlighted');
            icon.style.display = '';
        }
        m.unbindTooltip(); // Clears any permanent label
        
        // Re-bind standard hover tooltip
        const comm = communitiesData.find(c => c.id === id);
        if (comm) {
            m.bindTooltip(comm.name);
        }
    });
}

function highlightCommunities(communityIds, fitBounds = true, hideOthers = true, animate = true) {
    // If we're currently in Global Mode (no community markers), clear country badges
    const inGlobalMode = Object.keys(communityMarkers).length === 0;
    if (inGlobalMode) {
        markersGroup.clearLayers();
    }

    // Ensure markers exist for all target IDs
    communityIds.forEach(id => {
        if (!communityMarkers[id]) {
            const comm = communitiesData.find(c => c.id === id);
            if (comm) {
                const marker = L.marker(comm.coords);
                marker.bindTooltip(comm.name);
                marker.on('click', () => {
                    resetHighlights();
                    if (typeof isInterMapMode !== 'undefined' && isInterMapMode) closeInterventionMapView();
                    const colAct = document.getElementById('col-activities');
                    if (colAct && !colAct.classList.contains('hidden')) closeActivitiesSidebarView();
                    const colKnow = document.getElementById('col-knowledge');
                    if (colKnow && !colKnow.classList.contains('hidden')) closeKnowledgeSidebarView();

                    renderColumn(comm, 'main');
                    sidebar.classList.remove('hidden');
                    showBtn.classList.add('hidden');
                });
                markersGroup.addLayer(marker);
                communityMarkers[id] = marker;
            }
        }
    });

    resetHighlights();
    const markersToFit = [];
    Object.keys(communityMarkers).forEach(id => {
        const m = communityMarkers[id];
        const icon = m.getElement();
        
        // Ensure communityIds is an array (to handle single ID pass safely)
        const ids = Array.isArray(communityIds) ? communityIds : [communityIds];

        if (ids.includes(id)) {
            if (icon) {
                icon.style.display = '';
                icon.classList.add('leaflet-marker-highlighted');
            }
            markersToFit.push(m.getLatLng());
            
            const comm = communitiesData.find(c => c.id === id);
            if (comm) {
                m.unbindTooltip();
                m.bindTooltip(comm.name, {
                    permanent: true, 
                    direction: 'right', 
                    className: 'comm-label-tooltip',
                    offset: [15, -20]
                }).openTooltip();
            }
        } else if (hideOthers) {
            if (icon) icon.style.display = 'none';
        }
    });

    if (fitBounds && markersToFit.length > 0) {
        const ids = Array.isArray(communityIds) ? communityIds : [communityIds];
        const padding = getMapPadding();
        
        // If it's a single community and has an extent, fit to that extent
        if (ids.length === 1) {
            const comm = communitiesData.find(c => c.id === ids[0]);
            if (comm && comm.extent) {
                const b = L.latLngBounds([[comm.extent.n, comm.extent.w], [comm.extent.s, comm.extent.e]]);
                if (animate) {
                    map.flyToBounds(b, { animate: true, duration: 1.5, paddingBottomRight: padding, paddingTopLeft: [50, 50] });
                } else {
                    map.fitBounds(b, { paddingBottomRight: padding, paddingTopLeft: [50, 50] });
                }
                return;
            }
        }
        
        const bounds = L.latLngBounds(markersToFit).pad(0.3);
        if (animate) {
            map.flyToBounds(bounds, { animate: true, duration: 1.5, paddingBottomRight: padding, paddingTopLeft: [50, 50] });
        } else {
            map.fitBounds(bounds, { paddingBottomRight: padding, paddingTopLeft: [50, 50] });
        }
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
            const col = btn.dataset.col; 
            const tab = btn.dataset.tab; 

            // Update buttons in this column
            document.querySelectorAll(`.tab-btn[data-col="${col}"]`).forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update contents in this column
            document.querySelectorAll(`.tab-content[id*="-${col}"]`).forEach(c => c.classList.add('hidden'));
            document.getElementById(`tab-${tab}-${col}`).classList.remove('hidden');
            
            // Manage headers for Activities tab
            if (col === 'main') {
                const filtersDiv = document.querySelector('#col-main .filters');
                const titleHeading = document.getElementById('community-name');
                const globalCommSelect = document.getElementById('community-select');
                
                if (tab === 'activities') {
                    if (filtersDiv) filtersDiv.classList.add('hidden');
                    if (titleHeading) titleHeading.innerText = 'Activities';
                    
                    const cFilter = document.getElementById('country-select') ? document.getElementById('country-select').value : 'All';
                    const comm = (globalCommSelect && globalCommSelect.value !== 'All') 
                            ? communitiesData.find(c => c.id === globalCommSelect.value) 
                            : null;
                    renderActivities(comm, 'activities-list-main', cFilter);
                } else {
                    if (filtersDiv) filtersDiv.classList.remove('hidden');
                    // Restore title
                    const activeComm = communitiesData.find(c => c.id === (globalCommSelect ? globalCommSelect.value : 'All'));
                    if (titleHeading) {
                        if (activeComm) titleHeading.innerText = 'Community Overview';
                        else {
                            const cFilter = document.getElementById('country-select') ? document.getElementById('country-select').value : 'All';
                            titleHeading.innerText = cFilter !== "All" ? 'Country Overview' : 'Global Overview';
                        }
                    }
                }
            }
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
            const commSelect = document.getElementById('community-select');
            const activeComm = (commSelect && commSelect.value !== 'All') 
                ? communitiesData.find(c => c.id === commSelect.value) || null 
                : null;
            renderColumn(activeComm, side);
        });
    }
});

function renderColumn(community, colType) {
    const countryFilter = document.getElementById('country-select') ? document.getElementById('country-select').value : 'All';
    let title = "Global Overview";
    if (community) {
        title = `Community Overview`;
    } else if (countryFilter !== "All") {
        title = `Country Overview`;
    }
    document.getElementById('community-name').innerText = title;

    // Toggle Landing Page UI
    const colMain = document.getElementById('col-main');
    const tabsContainer = colMain.querySelector('.tabs');
    
    if (!community) {
        // Hide tabs menu completely
        if (tabsContainer) tabsContainer.classList.add('hidden');
        
        // Force Overview (Demographics) tab to be the only visible content
        colMain.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        document.getElementById('tab-demographics-main').classList.remove('hidden');
    } else {
        // Show tabs menu
        if (tabsContainer) tabsContainer.classList.remove('hidden');
        
        // Restore active tab display based on buttons
        const activeBtn = colMain.querySelector('.tab-btn.active') || colMain.querySelector('.tab-btn');
        if (activeBtn) {
            colMain.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            document.getElementById(`tab-${activeBtn.dataset.tab}-main`).classList.remove('hidden');
        }
    }
    
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
            const time = a.yearsQuarters ? a.yearsQuarters.join(', ') : 'N/A';
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
            const time = a.yearsQuarters ? a.yearsQuarters.join(', ') : 'N/A';
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
        title = "Community Demography";
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

        d.description = `Aggregated data across ${filtered.length} communities in ${currentCountry === "All" ? "all countries" : currentCountry}.`;
        title = `Demography- ${currentCountry}`;
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
        ${community ? `
            <button class="toggle-btn-small" 
                    style="margin-top: 15px; width: 100%; border: 1px solid var(--primary); color: var(--primary); background: #eff6ff; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600;" 
                    onclick="openCommunityMapFor('${community.id}')">
                <i data-lucide="map"></i> See Community Map
            </button>
        ` : ''}
    `;

    // Add Theoretical Definitions or Country Brief below aggregate demographics
    const defContainer = document.getElementById('theoretical-definitions-main');
    if (defContainer) {
        defContainer.innerHTML = '';
        if (!community) {
            defContainer.style.display = 'block';
            defContainer.classList.remove('hidden');
            
            const currentCountry = document.getElementById('country-select').value;
            
            if (currentCountry !== 'All') {
                // Country Mode: Show Country Brief
                const cData = staticData.countries.find(c => c.name === currentCountry);
                const brief = cData && cData.brief ? cData.brief : `Brief overview for ${currentCountry} is currently unavailable. Data monitoring and resilience mapping is actively ongoing.`;
                
                const defHeader = document.createElement('h3');
                defHeader.innerText = "Country Brief";
                defHeader.style.margin = "10px 0 20px 0";
                defHeader.style.fontSize = "0.9rem";
                defHeader.style.color = "var(--primary)";
                defHeader.style.textTransform = "uppercase";
                defContainer.appendChild(defHeader);
                
                const briefDiv = document.createElement('div');
                briefDiv.className = 'info-card';
                briefDiv.style.marginBottom = '15px';
                briefDiv.style.borderLeft = `4px solid var(--primary)`;
                briefDiv.style.paddingLeft = '12px';
                briefDiv.style.fontSize = '0.9rem';
                briefDiv.style.lineHeight = '1.6';
                briefDiv.style.color = 'var(--text-main)';
                briefDiv.innerHTML = brief;
                defContainer.appendChild(briefDiv);
                
            } else {
                // Global Mode: Show Theoretical Definitions
                const defHeader = document.createElement('h3');
                defHeader.innerText = "Theoretical Definitions";
                defHeader.style.margin = "10px 0 20px 0";
                defHeader.style.fontSize = "0.9rem";
                defHeader.style.color = "var(--primary)";
                defHeader.style.textTransform = "uppercase";
                defContainer.appendChild(defHeader);

                staticData.capitals.forEach(cap => {
                    const defDiv = document.createElement('div');
                    defDiv.style.marginBottom = '15px';
                    defDiv.style.borderLeft = `4px solid ${cap.color}`;
                    defDiv.style.paddingLeft = '12px';
                    defDiv.innerHTML = `
                        <div style="font-weight: 700; color: ${cap.color}; margin-bottom: 5px;">${cap.name}</div>
                        <div style="font-size: 0.85rem; line-height: 1.5; color: var(--text-muted);">${cap.description}</div>
                    `;
                    defContainer.appendChild(defDiv);
                });
            }
        } else {
            defContainer.style.display = 'none';
        }
    }

    lucide.createIcons();
}

function renderActivities(community, targetId, countryFilter = "All") {
    const list = document.getElementById(targetId);
    list.innerHTML = '';

    if (community) {
        const related = activitiesData.filter(a => a.communityIds.includes(community.id));
        related.forEach(act => {
            const time = act.yearsQuarters ? act.yearsQuarters.join(', ') : 'N/A';
            const li = document.createElement('li');
            li.style.cursor = 'pointer';
            li.style.transition = 'transform 0.2s, box-shadow 0.2s';
            li.onmouseover = () => { li.style.transform = 'translateY(-2px)'; li.style.boxShadow = '0 8px 16px rgba(0,0,0,0.06)'; };
            li.onmouseout = () => { li.style.transform = 'translateY(0)'; li.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)'; };

            const indText = act.indicatorIds && act.indicatorIds.length > 0
                ? act.indicatorIds.map(id => {
                    for (const cap in indicatorsData) {
                        if (indicatorsData[cap]) {
                            const found = indicatorsData[cap].find(i => i.id === id);
                            if (found) return found.name;
                        }
                    }
                    return id;
                  }).join(', ')
                : 'None';

            let benText = 'None specified';
            if (act.beneficiaries) {
                const b = act.beneficiaries;
                const total = (b.men||0) + (b.women||0) + (b.oldMen||0) + (b.oldWomen||0) + (b.newMen||0) + (b.newWomen||0);
                if (total > 0) {
                    benText = `Total: ${total} (Men: ${(b.men||0)+(b.oldMen||0)+(b.newMen||0)}, Women: ${(b.women||0)+(b.oldWomen||0)+(b.newWomen||0)})`;
                }
            }

            const commListHtml = act.communityIds.map(cid => {
                const comm = communitiesData.find(c => c.id === cid);
                return comm ? `<li>${comm.name} (${time})</li>` : '';
            }).join('');
            
            li.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <strong style="color: var(--primary); display: block; margin-bottom: 4px; font-size: 0.95rem;">${act.name}</strong>
                        <small style="color: #64748b;">
                            <i data-lucide="calendar" style="width: 12px; height: 12px; vertical-align: middle;"></i> ${time}
                        </small>
                    </div>
                    <span class="chevron" style="color: var(--text-muted); font-size: 0.8rem; margin-top: 2px;">▼</span>
                </div>
                <div class="activity-details-global hidden" style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed #e2e8f0; font-size: 0.8rem; color: var(--text-muted);">
                    <div style="margin-bottom: 6px;"><strong style="color: var(--text-main);">Indicators:</strong> ${indText}</div>
                    <div style="margin-bottom: 6px;"><strong style="color: var(--text-main);">Beneficiaries:</strong> ${benText}</div>
                    <div style="margin-bottom: 6px;"><strong style="color: var(--text-main);">Knowledge Generated:</strong> ${act.knowledgeGenerated ? '<span style="color:#10b981; font-weight:600;">Yes</span>' : 'No'}</div>
                    <div style="margin-bottom: 6px;"><strong style="color: var(--text-main);">Communities Undertaken:</strong>
                        <ul style="margin: 4px 0 0 16px; padding: 0; list-style-type: disc;">
                            ${commListHtml || '<li>None</li>'}
                        </ul>
                    </div>
                </div>
            `;
            
            li.onclick = () => {
                const details = li.querySelector('.activity-details-global');
                const chevron = li.querySelector('.chevron');
                const isHidden = details.classList.contains('hidden');
                
                if (isHidden) {
                    details.classList.remove('hidden');
                    chevron.innerText = '▲';
                    highlightCommunities(act.communityIds, true);
                } else {
                    details.classList.add('hidden');
                    chevron.innerText = '▼';
                    resetHighlights();
                }
            };
            
            list.appendChild(li);
        });
        if (window.lucide) window.lucide.createIcons();
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
                        const time = a.yearsQuarters ? a.yearsQuarters.join(', ') : 'N/A';
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
                    highlightCommunities(act.instances.map(i => i.commId), false);
                } else {
                    details.classList.add('hidden');
                    li.classList.remove('expanded');
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
    
    ctx.lineWidth = 20;
    
    // Draw 3 segmented intervals (0-33, 33-67, 67-100)
    // 0 to 33 (Degraded)
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, Math.PI + (Math.PI * 0.33));
    ctx.strokeStyle = '#fca5a5';
    ctx.stroke();

    // 33 to 67 (Moderate)
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI + (Math.PI * 0.33), Math.PI + (Math.PI * 0.67));
    ctx.strokeStyle = '#fde047';
    ctx.stroke();

    // 67 to 100 (Optimal)
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI + (Math.PI * 0.67), 0);
    ctx.strokeStyle = '#86efac';
    ctx.stroke();

    // Add visual separators for the bounds (33, 67)
    ctx.lineWidth = 22;
    ctx.strokeStyle = '#ffffff';
    [0.33, 0.67].forEach(pct => {
        ctx.beginPath();
        const angle = Math.PI + (Math.PI * pct);
        ctx.arc(cx, cy, r, angle - 0.015, angle + 0.015);
        ctx.stroke();
    });

    const showT0 = document.getElementById(`show-t0-${side}`).checked;
    const showT1 = document.getElementById(`show-t1-${side}`).checked;

    if (showT0) drawNeedle(ctx, cx, cy, r - 10, (t0 / 100) * Math.PI, '#94a3b8');
    if (showT1) drawNeedle(ctx, cx, cy, r, (t1 / 100) * Math.PI, '#2563eb');
}

function drawNeedle(ctx, x, y, len, angle, color) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI + angle);
    ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(len, 0); ctx.lineTo(0, 2);
    ctx.fillStyle = color; ctx.fill(); ctx.restore();
}

function renderCapitals(community, containerId, side) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    if (!community) return;

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
                const time = a.yearsQuarters ? a.yearsQuarters.join(', ') : 'N/A';
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
        const time = (act.year && act.quarter) ? `${act.year}-Q${act.quarter}` : 'N/A';
        const item = document.createElement('div');
        item.className = 'manage-act-item';
        item.style.cursor = 'pointer';
        item.style.transition = 'transform 0.2s, box-shadow 0.2s';
        item.style.display = 'block';
        item.onmouseover = () => { item.style.transform = 'translateY(-2px)'; item.style.boxShadow = '0 8px 16px rgba(0,0,0,0.06)'; };
        item.onmouseout = () => { item.style.transform = 'translateY(0)'; item.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)'; };

        const indText = act.indicatorIds && act.indicatorIds.length > 0
            ? act.indicatorIds.map(id => {
                for (const cap in indicatorsData) {
                    if (indicatorsData[cap]) {
                        const found = indicatorsData[cap].find(i => i.id === id);
                        if (found) return found.name;
                    }
                }
                return id;
              }).join(', ')
            : 'None';

        let benText = 'None specified';
        if (act.beneficiaries) {
            const b = act.beneficiaries;
            const total = (b.men||0) + (b.women||0) + (b.oldMen||0) + (b.oldWomen||0) + (b.newMen||0) + (b.newWomen||0);
            if (total > 0) {
                benText = `Total: ${total} (Men: ${(b.men||0)+(b.oldMen||0)+(b.newMen||0)}, Women: ${(b.women||0)+(b.oldWomen||0)+(b.newWomen||0)})`;
            }
        }
        
        item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <strong style="color: var(--primary); display: block; margin-bottom: 4px; font-size: 0.95rem;">${act.name}</strong>
                    <small style="color: #64748b;">
                        <i data-lucide="calendar" style="width: 12px; height: 12px; vertical-align: middle;"></i> ${time}
                        | Targets: ${act.targetEntities ? act.targetEntities.length : act.communityIds.length}
                    </small>
                </div>
                <span class="chevron" style="color: var(--text-muted); font-size: 0.8rem; margin-top: 2px;">▼</span>
            </div>
            <div class="activity-details-global hidden" style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed #e2e8f0; font-size: 0.8rem; color: var(--text-muted);">
                <div style="margin-bottom: 6px;"><strong style="color: var(--text-main);">Indicators:</strong> ${indText}</div>
                <div style="margin-bottom: 6px;"><strong style="color: var(--text-main);">Beneficiaries:</strong> ${benText}</div>
                <div><strong style="color: var(--text-main);">Knowledge Generated:</strong> ${act.knowledgeGenerated ? '<span style="color:#10b981; font-weight:600;">Yes</span>' : 'No'}</div>
            </div>
        `;
        
        item.onclick = () => {
            const details = item.querySelector('.activity-details-global');
            const chevron = item.querySelector('.chevron');
            const isHidden = details.classList.contains('hidden');
            
            if (isHidden) {
                details.classList.remove('hidden');
                chevron.innerText = '▲';
            } else {
                details.classList.add('hidden');
                chevron.innerText = '▼';
            }
        };
        
        listEl.appendChild(item);
    });
    if (window.lucide) window.lucide.createIcons();
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
    const countryEl = document.getElementById('dash-filter-country');
    const provEl = document.getElementById('dash-filter-province');
    const distEl = document.getElementById('dash-filter-district');
    const muniEl = document.getElementById('dash-filter-municipality');
    const commEl = document.getElementById('dash-filter-community');

    if (!countryEl || !provEl || !distEl || !muniEl || !commEl) return;

    // 1. Countries
    const curCountry = countryEl.value || 'All';
    const countries = [...new Set(communitiesData.map(c => c.country))].filter(Boolean).sort();
    countryEl.innerHTML = '<option value="All">All Countries</option>' + countries.map(c => `<option value="${c}">${c}</option>`).join('');
    if (countries.includes(curCountry)) countryEl.value = curCountry;
    else countryEl.value = 'All';

    let filtered = communitiesData;

    // 2. Provinces
    const curProv = provEl.value || 'All';
    if (countryEl.value !== 'All') filtered = filtered.filter(c => c.country === countryEl.value);
    const provinces = [...new Set(filtered.map(c => c.province))].filter(Boolean).sort();
    provEl.innerHTML = '<option value="All">All Provinces</option>' + provinces.map(p => `<option value="${p}">${p}</option>`).join('');
    if (provinces.includes(curProv)) provEl.value = curProv;
    else provEl.value = 'All';

    // 3. Districts
    const curDist = distEl.value || 'All';
    if (provEl.value !== 'All') filtered = filtered.filter(c => c.province === provEl.value);
    const districts = [...new Set(filtered.map(c => c.district))].filter(Boolean).sort();
    distEl.innerHTML = '<option value="All">All Districts</option>' + districts.map(d => `<option value="${d}">${d}</option>`).join('');
    if (districts.includes(curDist)) distEl.value = curDist;
    else distEl.value = 'All';

    // 4. Municipalities
    const curMuni = muniEl.value || 'All';
    if (distEl.value !== 'All') filtered = filtered.filter(c => c.district === distEl.value);
    const municipalities = [...new Set(filtered.map(c => c.municipality))].filter(Boolean).sort();
    muniEl.innerHTML = '<option value="All">All Municipalities</option>' + municipalities.map(m => `<option value="${m}">${m}</option>`).join('');
    if (municipalities.includes(curMuni)) muniEl.value = curMuni;
    else muniEl.value = 'All';

    // 5. Communities
    const curComm = commEl.value || 'All';
    if (muniEl.value !== 'All') filtered = filtered.filter(c => c.municipality === muniEl.value);
    commEl.innerHTML = '<option value="All">All Communities</option>' + filtered.map(c => {
        const duplicates = filtered.filter(oc => oc.name === c.name);
        const displayName = duplicates.length > 1 ? `${c.name} (${c.district}, ${c.country})` : c.name;
        return `<option value="${c.id}">${displayName}</option>`;
    }).join('');
    if (filtered.some(c => c.id === curComm)) commEl.value = curComm;
    else commEl.value = 'All';

    // 6. Years
    const yearSelect = document.getElementById('dash-filter-year');
    if (yearSelect) {
        const curYear = yearSelect.value || 'All';
        const allYears = [...new Set(activitiesData.flatMap(a => (a.yearsQuarters || []).map(yq => yq.split('-')[0])))];
        const years = allYears.filter(Boolean).sort((a,b) => b - a);
        yearSelect.innerHTML = '<option value="All">All Years</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
        if (years.includes(curYear)) yearSelect.value = curYear;
        else yearSelect.value = 'All';
    }
}

// Auto-refresh filters
['dash-filter-country', 'dash-filter-province', 'dash-filter-district', 'dash-filter-municipality', 'dash-filter-community', 'dash-filter-year', 'dash-filter-quarter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', updateDashboard);
});

document.getElementById('dash-refresh-btn').addEventListener('click', updateDashboard);

function updateDashboard() {
    populateDashboardFilters();
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
        if (year !== 'All' && year !== '') {
            const hasYear = act.yearsQuarters && act.yearsQuarters.some(yq => yq.startsWith(year));
            if (!hasYear) return;
        }
        if (quarter !== 'All') {
            const qCode = quarter.startsWith('Q') ? quarter : `Q${quarter}`;
            const hasQuarter = act.yearsQuarters && act.yearsQuarters.some(yq => yq.endsWith(qCode));
            if (!hasQuarter) return;
        }

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

function renderInterventionMarkers(animate = true) {
    if (!interventionsGroup) return;
    interventionsGroup.clearLayers();

    const countryVal = document.getElementById('country-select') ? document.getElementById('country-select').value : 'All';

    let filtered = interventionsData;

    if (countryVal !== "All") {
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
        marker.bindTooltip(intervention.name);
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
        if (animate) {
            map.flyToBounds(L.latLngBounds(validCoords), { padding: [50, 50], maxZoom: 12, animate: true, duration: 1.5 });
        } else {
            map.fitBounds(L.latLngBounds(validCoords), { padding: [50, 50], maxZoom: 12 });
        }
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

    // 1. Build sidebar structure if not present
    if (!document.getElementById('interventions-sidebar-comm-filter')) {
        colInt.style.display = 'flex';
        colInt.style.flexDirection = 'column';
        colInt.style.overflow = 'hidden';

        const countryOptions = '<option value="All">All Countries</option>' + countriesData.sort((a,b) => a.name.localeCompare(b.name)).map(c => `<option value="${c.name}">${c.name}</option>`).join('');

        const headerHtml = `
            <div class="column-info" style="padding: 20px 20px 10px 20px; border-bottom: 1px solid #e2e8f0; flex-shrink: 0; background: white;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <h2 id="interventions-sidebar-title" style="margin:0; color: #d97706;">Interventions</h2>
                    <button class="toggle-btn-small danger" onclick="closeInterventionMapView()" style="margin:0; padding: 4px 8px; width: auto;">&times; Close</button>
                </div>
                <div style="display: flex; gap: 8px; margin-top: 15px;">
                    <select id="interventions-sidebar-country-filter" class="form-select" style="flex:1;">
                        ${countryOptions}
                    </select>
                    <select id="interventions-sidebar-comm-filter" class="form-select" style="flex:1;">
                        <option value="All">All Communities</option>
                    </select>
                </div>
                <p style="font-size: 0.82rem; color: var(--text-muted); margin-top: 8px; line-height: 1.3;">Select an intervention to locate it on the map.</p>
            </div>
            <div style="flex: 1; overflow-y: auto; padding: 15px 15px 15px 15px; background: #f8fafc;">
                <div id="interventions-sidebar-list-container" style="display: flex; flex-direction: column; gap: 12px;"></div>
            </div>
        `;
        colInt.innerHTML = headerHtml;

        document.getElementById('interventions-sidebar-country-filter').addEventListener('change', () => {
            renderInterventionSidebarList(interventionsData); // Full set to re-filter
        });
        document.getElementById('interventions-sidebar-comm-filter').addEventListener('change', () => {
            renderInterventionSidebarList(interventionsData); 
        });
    }

    const listContainer = document.getElementById('interventions-sidebar-list-container');
    const filterEl = document.getElementById('interventions-sidebar-comm-filter');
    const countryEl = document.getElementById('interventions-sidebar-country-filter');
    const titleEl = document.getElementById('interventions-sidebar-title');
    if (!listContainer) return;

    // Filter by local Country first
    const selectedCountry = countryEl.value;
    let filtered = interventions;
    if (selectedCountry !== "All") {
        const commIdsInCountry = new Set(communitiesData.filter(c => c.country === selectedCountry).map(c => c.id));
        filtered = filtered.filter(i => i.communityIds && i.communityIds.some(cid => commIdsInCountry.has(cid)));
    }

    // Populate local Community filter from the filtered list (by country)
    const uniqueCommIds = new Set();
    filtered.forEach(i => {
        if (i.communityIds) i.communityIds.forEach(cid => uniqueCommIds.add(cid));
    });
    
    const curComm = filterEl.value;
    let commOptions = '<option value="All">All Communities</option>';
    const commsForFilter = communitiesData
        .filter(c => uniqueCommIds.has(c.id))
        .sort((a,b) => a.name.localeCompare(b.name));
    commsForFilter.forEach(c => {
        commOptions += `<option value="${c.id}">${c.name}</option>`;
    });
    filterEl.innerHTML = commOptions;
    if (uniqueCommIds.has(curComm)) filterEl.value = curComm;

    listContainer.innerHTML = '';
    
    // Apply local community filter
    let filteredList = filtered;
    if (filterEl.value !== 'All') {
        filteredList = filtered.filter(i => i.communityIds && i.communityIds.includes(filterEl.value));
    }

    if (titleEl) {
        titleEl.innerText = `Interventions (${filteredList.length})`;
    }

    if (filteredList.length === 0) {
        listContainer.innerHTML = '<div style="padding: 20px; color: var(--text-muted); text-align: center; margin-top: 20px;">No interventions found for this selection.</div>';
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

    filteredList.forEach(inter => {
        const catColor = (inter.category && categoryColors[inter.category]) ? categoryColors[inter.category] : '#d97706';
        const item = document.createElement('div');
        item.className = 'dash-card sidebar-list-card';
        item.style.cursor = 'pointer';
        item.style.padding = '14px';
        item.style.background = 'white';
        item.style.borderRadius = '12px';
        item.style.transition = 'transform 0.2s, box-shadow 0.2s';
        item.onmouseover = () => { item.style.transform = 'translateY(-2px)'; item.style.boxShadow = '0 8px 16px rgba(0,0,0,0.06)'; };
        item.onmouseout = () => { item.style.transform = 'translateY(0)'; item.style.boxShadow = '0 2px 6px rgba(0,0,0,0.04)'; };

        const commListHtml = inter.communityIds && inter.communityIds.length > 0 
            ? inter.communityIds.map(cid => {
                const comm = communitiesData.find(c => c.id === cid);
                const timeStr = inter.yearsQuarters ? inter.yearsQuarters.join(', ') : 'N/A';
                return comm ? `<li>${comm.name} <span style="color:#64748b; font-size:0.75rem; margin-left:5px;">(${timeStr})</span></li>` : `<li>ID: ${cid}</li>`;
            }).join('')
            : '<li>None</li>';

        item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="margin-bottom: 8px;">
                    <h4 style="margin: 0; color: var(--text-main); font-size: 0.95rem;">${inter.name}</h4>
                    <div style="font-size: 0.75rem; color: #64748b; margin-top: 5px;">
                        ${inter.category ? `<span style="font-size:0.7rem;background:${catColor};color:white;padding:2px 7px;border-radius:12px;font-weight:600;display:inline-block;margin-bottom:4px;">${inter.category}</span><br>` : ''}
                        <i data-lucide="calendar" style="width: 12px; height: 12px; vertical-align: middle;"></i> 
                        ${inter.yearsQuarters ? inter.yearsQuarters.join(', ') : 'N/A'}<br>
                        <i data-lucide="map-pin" style="width: 12px; height: 12px; vertical-align: middle;"></i> 
                        ${inter.coords ? `${inter.coords[0].toFixed(3)}, ${inter.coords[1].toFixed(3)}` : 'No valid coordinates'}
                    </div>
                </div>
                <span class="chevron" style="color: var(--text-muted); font-size: 0.8rem; margin-top: 2px;">▼</span>
            </div>
            <div class="intervention-details hidden" style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed #e2e8f0; font-size: 0.8rem; color: var(--text-muted);">
                <div style="margin-bottom: 8px;">
                    <strong style="color: var(--text-main);">Summary:</strong><br>
                    ${inter.description || 'No summary available.'}
                </div>
                <div style="margin-bottom: 6px;"><strong style="color: var(--text-main);">Communities Undertaken:</strong>
                    <ul style="margin: 4px 0 0 16px; padding: 0; list-style-type: disc;">
                        ${commListHtml}
                    </ul>
                </div>
            </div>
        `;

        item.onclick = () => {
            const details = item.querySelector('.intervention-details');
            const chevron = item.querySelector('.chevron');
            const isHidden = details.classList.contains('hidden');

            // Close others
            listContainer.querySelectorAll('.intervention-details').forEach(d => {
                if (d !== details) d.classList.add('hidden');
            });
            listContainer.querySelectorAll('.chevron').forEach(c => {
                if (c !== chevron) c.innerText = '▼';
            });

            if (isHidden) {
                details.classList.remove('hidden');
                chevron.innerText = '▲';
                zoomToIntervention(inter.id);
            } else {
                details.classList.add('hidden');
                chevron.innerText = '▼';
                resetHighlights();
                resetInterventionHighlights();
            }
        };

        listContainer.appendChild(item);
    });
    if (window.lucide) window.lucide.createIcons();
}

window.zoomToIntervention = function(id, animate = true) {
    const inter = interventionsData.find(i => i.id === id);
    if (!inter || !inter.coords) return;
    
    // Smoothly pan to the intervention point using standard sidebar-aware padding
    if (animate) {
        map.flyToBounds(L.latLngBounds([inter.coords, inter.coords]), { 
            maxZoom: 14, 
            paddingBottomRight: getMapPadding(), 
            paddingTopLeft: [50, 50],
            animate: true,
            duration: 1.5
        });
    } else {
        map.fitBounds(L.latLngBounds([inter.coords, inter.coords]), { 
            maxZoom: 14, 
            paddingBottomRight: getMapPadding(), 
            paddingTopLeft: [50, 50]
        });
    }
    
    // Hide other intervention markers
    interventionsGroup.eachLayer(layer => {
        const el = layer.getElement();
        if (el) {
            if (interventionMarkers[id] === layer) {
                el.style.display = '';
                el.classList.add('leaflet-marker-highlighted');
            } else {
                el.style.display = 'none';
            }
        }
    });

    // Highlight related communities if any
    if (inter.communityIds && inter.communityIds.length > 0) {
        highlightCommunities(inter.communityIds, true, false); // fitBounds=true, hideOthers=false
    }
    
    // Open the associated Map Popup directly
    if (interventionMarkers[id]) {
        setTimeout(() => {
            interventionMarkers[id].openPopup();
        }, 300);
    }
};

window.resetInterventionHighlights = function() {
    interventionsGroup.eachLayer(layer => {
        const el = layer.getElement();
        if (el) {
            el.style.display = '';
            el.classList.remove('leaflet-marker-highlighted');
        }
    });
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

function openInterventionMapView(animate = true) {
    const colAct = document.getElementById('col-activities');
    if (colAct && !colAct.classList.contains('hidden')) {
        closeActivitiesSidebarView();
    }
    const colKnow = document.getElementById('col-knowledge');
    if (colKnow && !colKnow.classList.contains('hidden')) {
        closeKnowledgeSidebarView();
    }

    isInterMapMode = true;
    
    // 1. Manage Layers
    renderInterventionMarkers(animate); // Ensure markers are created before adding
    if (map.hasLayer(markersGroup)) map.removeLayer(markersGroup);
    if (!map.hasLayer(interventionsGroup)) map.addLayer(interventionsGroup);

    // 2. Manage UI
    manageInterventionsModal.classList.add('hidden');
    sidebar.classList.remove('hidden');
    document.getElementById('col-main').classList.add('hidden');
    
    // Hide global filters
    const gf = document.getElementById('global-filters-container');
    if (gf) gf.classList.add('hidden');
    
    const colInt = document.getElementById('col-intervention');
    if (colInt) {
        colInt.classList.remove('hidden');
    }

    showBtn.classList.add('hidden');
    // closeInterMapBtn removed from here as it's now in sidebar
}

function closeInterventionMapView() {
    isInterMapMode = false;
    
    // Show global filters
    const gf = document.getElementById('global-filters-container');
    if (gf) gf.classList.remove('hidden');
    // 1. Manage Layers
    if (!map.hasLayer(markersGroup)) map.addLayer(markersGroup);
    if (map.hasLayer(interventionsGroup)) map.removeLayer(interventionsGroup);

    // 2. Manage UI
    sidebar.classList.remove('hidden');
    document.getElementById('col-main').classList.remove('hidden');
    const colInt = document.getElementById('col-intervention');
    if (colInt) colInt.classList.add('hidden');
    
    // closeInterMapBtn removed from here as it's now in sidebar

    // 3. Reset View
    const countryName = document.getElementById('country-select').value;
    onCountrySelection(countryName, false);
}

// ===== OVERVIEW / LANDING PAGE =====
const viewOverviewBtn = document.getElementById('view-overview-btn');
if (viewOverviewBtn) {
    viewOverviewBtn.addEventListener('click', () => {
        // Force reset all sidebar states
        isInterMapMode = false;
        if (typeof isActivitiesMode !== 'undefined') isActivitiesMode = false;
        isKnowledgeMode = false;

        // Ensure sidebar and global filters are visible
        if (sidebar) sidebar.classList.remove('hidden');
        const gf = document.getElementById('global-filters-container');
        if (gf) gf.classList.remove('hidden');
        const cm = document.getElementById('col-main');
        if (cm) cm.classList.remove('hidden');

        // Hide other specialized columns
        ['col-intervention', 'col-activities', 'col-knowledge'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        // Reset map layers (ensure standard community/country markers)
        if (!map.hasLayer(markersGroup)) map.addLayer(markersGroup);
        if (typeof interventionsGroup !== 'undefined' && map.hasLayer(interventionsGroup)) {
            map.removeLayer(interventionsGroup);
        }

        // Return everything to Global view
        onCountrySelection('All', true, false); // Pass animate = false for initial load
    });
}

// ===== ACTIVITIES SIDEBAR VIEW =====
const viewActivitiesBtn = document.getElementById('view-activities-btn');

if (viewActivitiesBtn) {
    viewActivitiesBtn.addEventListener('click', openActivitiesSidebarView);
}

function openActivitiesSidebarView() {
    if (typeof isInterMapMode !== 'undefined' && isInterMapMode) {
        closeInterventionMapView();
    }
    const colKnow = document.getElementById('col-knowledge');
    if (colKnow && !colKnow.classList.contains('hidden')) {
        closeKnowledgeSidebarView();
    }

    // 1. Manage UI
    sidebar.classList.remove('hidden');
    document.getElementById('col-main').classList.add('hidden');
    
    // Hide global filters
    const gf = document.getElementById('global-filters-container');
    if (gf) gf.classList.add('hidden');
    
    const colInt = document.getElementById('col-intervention');
    if (colInt) colInt.classList.add('hidden');
    
    const colAct = document.getElementById('col-activities');
    if (colAct) {
        colAct.classList.remove('hidden');
        
        // 2. Build UI if not built
        if (!document.getElementById('activities-sidebar-comm-filter')) {
            colAct.style.display = 'flex';
            colAct.style.flexDirection = 'column';
            colAct.style.overflow = 'hidden';
            
            let commOptions = '<option value="All">All Communities</option>';
            communitiesData.sort((a,b) => a.name.localeCompare(b.name)).forEach(c => {
                commOptions += `<option value="${c.id}">${c.name}</option>`;
            });

            const countryOptions = '<option value="All">All Countries</option>' + countriesData.sort((a,b) => a.name.localeCompare(b.name)).map(c => `<option value="${c.name}">${c.name}</option>`).join('');

            let headerHtml = `
                <div class="column-info" style="padding: 20px 20px 10px 20px; border-bottom: 1px solid #e2e8f0; flex-shrink: 0; background: white;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <h2 id="activities-sidebar-title" style="margin:0; color: var(--primary);">Activities</h2>
                        <button class="toggle-btn-small danger" onclick="closeActivitiesSidebarView()" id="close-activities-view-manual-btn" style="margin:0; padding: 4px 8px; width: auto;">&times; Close</button>
                    </div>
                    <div style="display: flex; gap: 8px; margin-top: 15px;">
                        <select id="activities-sidebar-country-filter" class="form-select" style="flex:1;">
                            ${countryOptions}
                        </select>
                        <select id="activities-sidebar-comm-filter" class="form-select" style="flex:1;">
                            <option value="All">All Communities</option>
                        </select>
                    </div>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 8px; line-height: 1.3;">Click on an activity to view details.</p>
                </div>
                <div style="flex: 1; overflow-y: auto; padding: 15px 15px 15px 15px; background: #f8fafc;">
                    <div id="activities-sidebar-list-container" style="display: flex; flex-direction: column; gap: 12px;"></div>
                </div>
            `;
            colAct.innerHTML = headerHtml;

            document.getElementById('activities-sidebar-country-filter').addEventListener('change', () => {
                renderActivitiesSidebarList();
            });
            document.getElementById('activities-sidebar-comm-filter').addEventListener('change', () => {
                renderActivitiesSidebarList();
            });
        }
    }

    if (showBtn) showBtn.classList.add('hidden');
    if (closeInterMapBtn) closeInterMapBtn.classList.add('hidden');

    // 3. Render List
    renderActivitiesSidebarList();
}

function closeActivitiesSidebarView() {
    // 1. Manage UI
    sidebar.classList.remove('hidden');
    document.getElementById('col-main').classList.remove('hidden');
    
    const colAct = document.getElementById('col-activities');
    if (colAct) colAct.classList.add('hidden');
    
    resetHighlights();
}

function renderActivitiesSidebarList() {
    const listContainer = document.getElementById('activities-sidebar-list-container');
    const titleEl = document.getElementById('activities-sidebar-title');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    
    // Dynamic Dropdowns
    const countryEl = document.getElementById('activities-sidebar-country-filter');
    const filterEl = document.getElementById('activities-sidebar-comm-filter');
    if (!countryEl || !filterEl) return;
    
    const selectedCountry = countryEl.value;
    let filteredActs = activitiesData;
    if (selectedCountry !== "All") {
        const commIdsInCountry = new Set(communitiesData.filter(c => c.country === selectedCountry).map(c => c.id));
        filteredActs = activitiesData.filter(a => a.communityIds && a.communityIds.some(cid => commIdsInCountry.has(cid)));
    }

    // Populate local community filter from the filtered list (by country)
    const uniqueCommIds = new Set();
    filteredActs.forEach(a => {
        if (a.communityIds) a.communityIds.forEach(id => uniqueCommIds.add(id));
    });
    
    const curFilter = filterEl.value;
    let commOptionsHtml = '<option value="All">All Communities</option>';
    const commsForFilter = communitiesData
        .filter(c => uniqueCommIds.has(c.id))
        .sort((a,b) => a.name.localeCompare(b.name));
    commsForFilter.forEach(c => {
        commOptionsHtml += `<option value="${c.id}">${c.name}</option>`;
    });
    filterEl.innerHTML = commOptionsHtml;
    if (uniqueCommIds.has(curFilter)) filterEl.value = curFilter;

    if (filterEl.value !== 'All') {
        filteredActs = filteredActs.filter(a => a.communityIds.includes(filterEl.value));
    }
    
    // Group by Name to combine reach data
    const grouped = {};
    filteredActs.forEach(a => {
        if (!grouped[a.name]) {
            grouped[a.name] = {
                name: a.name,
                indicatorIds: a.indicatorIds,
                knowledgeGenerated: a.knowledgeGenerated,
                instances: [] // each instance has community info and reach
            };
        }
        // One instance per row? Or one per community?
        // Let's assume one instance per row (which might have multiple communities)
        grouped[a.name].instances.push(a);
    });

    const sortedNames = Object.keys(grouped).sort();

    if (titleEl) {
        titleEl.innerText = `Activities (${sortedNames.length})`;
    }

    if (sortedNames.length === 0) {
        listContainer.innerHTML = '<div style="padding: 20px; color: var(--text-muted); text-align: center; margin-top: 20px;">No activities found for this selection.</div>';
        return;
    }

    sortedNames.forEach(actName => {
        const group = grouped[actName];
        
        // Sum total beneficiaries across all instances
        const totalB = group.instances.reduce((acc, a) => {
            const b = a.beneficiaries;
            acc.men += (b.men||0) + (b.oldMen||0) + (b.newMen||0);
            acc.women += (b.women||0) + (b.oldWomen||0) + (b.newWomen||0);
            return acc;
        }, { men: 0, women: 0 });

        const timeAgg = [...new Set(group.instances.flatMap(a => (a.yearsQuarters || [])))].sort().join(', ');
        const allIndIds = [...new Set(group.instances.flatMap(a => a.indicatorIds))];

        const item = document.createElement('div');
        item.className = 'dash-card sidebar-list-card';
        item.style.cursor = 'pointer';
        item.style.padding = '14px';
        item.style.background = 'white';
        item.style.borderRadius = '12px';
        item.style.transition = 'transform 0.2s, box-shadow 0.2s';
        item.onmouseover = () => { item.style.transform = 'translateY(-2px)'; item.style.boxShadow = '0 8px 16px rgba(0,0,0,0.06)'; };
        item.onmouseout = () => { item.style.transform = 'translateY(0)'; item.style.boxShadow = '0 2px 6px rgba(0,0,0,0.04)'; };

        const indText = allIndIds.length > 0
            ? allIndIds.map(id => {
                for (const cap in indicatorsData) {
                    if (indicatorsData[cap]) {
                        const found = indicatorsData[cap].find(i => i.id === id);
                        if (found) return found.name;
                    }
                }
                return id;
              }).join(', ')
            : 'None';

        const commListHtml = group.instances.map(a => {
            const b = a.beneficiaries;
            const totalRow = (b.men||0) + (b.women||0) + (b.oldMen||0) + (b.oldWomen||0) + (b.newMen||0) + (b.newWomen||0);
            const perComm = Math.round(totalRow / a.communityIds.length);
            const time = a.yearsQuarters ? a.yearsQuarters.join(', ') : 'N/A';
            return a.communityIds.map(cid => {
                const comm = communitiesData.find(c => c.id === cid);
                return comm ? `<li>${comm.name} <span style="font-size:0.75rem; color:#64748b;">(${time})</span> - <span style="font-weight:600;">Reach: ${perComm}</span></li>` : '';
            }).join('');
        }).join('');
        
        item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="margin-bottom: 8px;">
                    <h4 style="margin: 0; color: var(--text-main); font-size: 0.95rem;">${actName}</h4>
                    <div style="font-size: 0.75rem; color: #64748b; margin-top: 5px;">
                        <i data-lucide="calendar" style="width: 12px; height: 12px; vertical-align: middle;"></i> 
                        ${timeAgg}
                    </div>
                </div>
                <span class="chevron" style="color: var(--text-muted); font-size: 0.8rem; margin-top: 2px;">▼</span>
            </div>
            <div class="activity-details-global hidden" style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed #e2e8f0; font-size: 0.8rem; color: var(--text-muted);">
                <div style="margin-bottom: 6px;"><strong style="color: var(--text-main);">Indicators:</strong> ${indText}</div>
                <div style="margin-bottom: 6px;"><strong style="color: var(--text-main);">Total Reach:</strong> ${totalB.men + totalB.women} (M: ${totalB.men}, W: ${totalB.women})</div>
                <div style="margin-bottom: 6px;"><strong style="color: var(--text-main);">Knowledge Generated:</strong> ${group.knowledgeGenerated ? '<span style="color:#10b981; font-weight:600;">Yes</span>' : 'No'}</div>
                <div style="margin-bottom: 6px;"><strong style="color: var(--text-main);">Communities Undertaken:</strong>
                    <ul style="margin: 4px 0 0 16px; padding: 0; list-style-type: disc;">
                        ${commListHtml || '<li>None</li>'}
                    </ul>
                </div>
            </div>
        `;
        
        item.onclick = () => {
            const details = item.querySelector('.activity-details-global');
            const chevron = item.querySelector('.chevron');
            const isHidden = details.classList.contains('hidden');
            
            // Optionally close others
            listContainer.querySelectorAll('.activity-details-global').forEach(d => {
                if (d !== details) d.classList.add('hidden');
            });
            listContainer.querySelectorAll('.chevron').forEach(c => {
                if (c !== chevron) c.innerText = '▼';
            });
            
            if (isHidden) {
                details.classList.remove('hidden');
                chevron.innerText = '▲';
                const allCommIds = [...new Set(group.instances.flatMap(a => a.communityIds))];
                highlightCommunities(allCommIds, true);
            } else {
                details.classList.add('hidden');
                chevron.innerText = '▼';
                resetHighlights();
            }
        };
        
        listContainer.appendChild(item);
    });
    
    if (window.lucide) window.lucide.createIcons();
}

// ===== KNOWLEDGE SIDEBAR VIEW =====
const viewKnowledgeBtn = document.getElementById('view-knowledge-btn');

if (viewKnowledgeBtn) {
    viewKnowledgeBtn.addEventListener('click', openKnowledgeSidebarView);
}

function openKnowledgeSidebarView() {
    if (typeof isInterMapMode !== 'undefined' && isInterMapMode) {
        closeInterventionMapView();
    }
    const colAct = document.getElementById('col-activities');
    if (colAct && !colAct.classList.contains('hidden')) {
        closeActivitiesSidebarView();
    }

    isKnowledgeMode = true; 
    
    // Hide global filters
    const gf = document.getElementById('global-filters-container');
    if (gf) gf.classList.add('hidden');
    
    sidebar.classList.remove('hidden');
    document.getElementById('col-main').classList.add('hidden');

    const colInt = document.getElementById('col-intervention');
    if (colInt) colInt.classList.add('hidden');
    
    const colActHide = document.getElementById('col-activities');
    if (colActHide) colActHide.classList.add('hidden');

    const colKnow = document.getElementById('col-knowledge');
    if (colKnow) {
        colKnow.classList.remove('hidden');
        colKnow.style.display = 'flex';
        colKnow.style.flexDirection = 'column';
        colKnow.style.overflow = 'hidden';
        
        let commOptions = '<option value="All">All Communities</option>';
        communitiesData.sort((a,b) => a.name.localeCompare(b.name)).forEach(c => {
            commOptions += `<option value="${c.id}">${c.name}</option>`;
        });

        // 2. Build UI if not built
        if (!document.getElementById('knowledge-sidebar-comm-filter')) {
            const countryOptions = '<option value="All">All Countries</option>' + countriesData.sort((a,b) => a.name.localeCompare(b.name)).map(c => `<option value="${c.name}">${c.name}</option>`).join('');

            let headerHtml = `
                <div class="column-info" style="padding: 20px 20px 10px 20px; border-bottom: 1px solid #e2e8f0; flex-shrink: 0; background: white;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <h2 id="knowledge-sidebar-title" style="margin:0; color: #8b5cf6;">Knowledge Hub</h2>
                        <button class="toggle-btn-small danger" onclick="closeKnowledgeSidebarView()" id="close-knowledge-view-btn" style="margin:0; padding: 4px 8px; width: auto;">&times; Close</button>
                    </div>
                    <div style="display: flex; gap: 8px; margin-top: 15px;">
                        <select id="knowledge-sidebar-country-filter" class="form-select" style="flex:1;">
                            ${countryOptions}
                        </select>
                        <select id="knowledge-sidebar-comm-filter" class="form-select" style="flex:1;">
                            <option value="All">All Communities</option>
                        </select>
                    </div>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 8px; line-height: 1.3;">Click on an item to view resources.</p>
                </div>
                <div style="flex: 1; overflow-y: auto; padding: 15px 15px 15px 15px; background: #f8fafc;">
                    <div id="knowledge-sidebar-list-container" style="display: flex; flex-direction: column; gap: 12px;"></div>
                </div>
            `;
            colKnow.innerHTML = headerHtml;

            document.getElementById('knowledge-sidebar-country-filter').addEventListener('change', () => {
                renderKnowledgeSidebarList();
            });
            document.getElementById('knowledge-sidebar-comm-filter').addEventListener('change', () => {
                renderKnowledgeSidebarList();
            });
        }
    }

    const closeInterMapBtn = document.getElementById('close-inter-map-btn');
    if (closeInterMapBtn) closeInterMapBtn.classList.add('hidden');
    
    // 3. Render List
    renderKnowledgeSidebarList();
}

function closeKnowledgeSidebarView() {
    isKnowledgeMode = false;
    
    // Show global filters
    const gf = document.getElementById('global-filters-container');
    if (gf) gf.classList.remove('hidden');

    sidebar.classList.remove('hidden');
    document.getElementById('col-main').classList.remove('hidden');
    
    const colKnow = document.getElementById('col-knowledge');
    if (colKnow) colKnow.classList.add('hidden');
    
    resetHighlights();
}

function renderKnowledgeSidebarList() {
    const listContainer = document.getElementById('knowledge-sidebar-list-container');
    const filterEl = document.getElementById('knowledge-sidebar-comm-filter');
    const countryEl = document.getElementById('knowledge-sidebar-country-filter');
    const titleEl = document.getElementById('knowledge-sidebar-title');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    
    // Base filter: Only activities with knowledgeGenerated
    let filtered = activitiesData.filter(a => a.knowledgeGenerated);

    // Sidebar Country Filter
    const selectedCountry = countryEl ? countryEl.value : 'All';
    if (selectedCountry !== "All") {
        const commIdsInCountry = new Set(communitiesData.filter(c => c.country === selectedCountry).map(c => c.id));
        filtered = filtered.filter(a => a.communityIds && a.communityIds.some(cid => commIdsInCountry.has(cid)));
    }

    // Populate local community filter from the filtered list (by country)
    const uniqueCommIds = new Set();
    filtered.forEach(a => {
        if (a.communityIds) a.communityIds.forEach(id => uniqueCommIds.add(id));
    });
    
    const curFilter = filterEl.value;
    let commOptionsHtml = '<option value="All">All Communities</option>';
    const commsForFilter = communitiesData
        .filter(c => uniqueCommIds.has(c.id))
        .sort((a,b) => a.name.localeCompare(b.name));
    commsForFilter.forEach(c => {
        commOptionsHtml += `<option value="${c.id}">${c.name}</option>`;
    });
    filterEl.innerHTML = commOptionsHtml;
    if (uniqueCommIds.has(curFilter)) filterEl.value = curFilter;

    if (filterEl.value !== 'All') {
        filtered = filtered.filter(a => a.communityIds.includes(filterEl.value));
    }

    // Sort by time desc (latest first)
    filtered.sort((a,b) => {
        const timeA = (a.yearsQuarters && a.yearsQuarters.length) ? a.yearsQuarters[0] : '0';
        const timeB = (b.yearsQuarters && b.yearsQuarters.length) ? b.yearsQuarters[0] : '0';
        return timeB.localeCompare(timeA);
    });
    
    if (titleEl) {
        titleEl.innerText = `Knowledge Hub (${filtered.length})`;
    }

    if (filtered.length === 0) {
        listContainer.innerHTML = '<div style="padding: 20px; color: var(--text-muted); text-align: center; margin-top: 20px;">No knowledge products found for this selection.</div>';
        return;
    }

    filtered.forEach(a => {
        const item = document.createElement('div');
        item.className = 'dash-card sidebar-list-card';
        item.style.cursor = 'pointer';
        item.style.padding = '16px';
        item.style.background = 'white';
        item.style.borderRadius = '12px';
        item.style.transition = 'transform 0.2s, box-shadow 0.2s';
        item.style.borderLeft = '4px solid #8b5cf6';
        item.style.marginBottom = '12px';
        item.onmouseover = () => { item.style.transform = 'translateY(-2px)'; item.style.boxShadow = '0 8px 16px rgba(0,0,0,0.06)'; };
        item.onmouseout = () => { item.style.transform = 'translateY(0)'; item.style.boxShadow = '0 2px 6px rgba(0,0,0,0.04)'; };

        const productTitle = a.knowledgeTitle || `Learning: ${a.name}`;
        const publishedYear = a.year || 'N/A';
        const brief = a.description || 'No brief available.';
        const activityName = a.name;
        
        const communityNames = a.communityIds.map(cid => {
            const c = communitiesData.find(comm => comm.id === cid);
            return c ? c.name : cid;
        }).join(', ');

        const linkHtml = a.knowledgeLink 
            ? `<div style="margin-top: 10px;">
                 <a href="${a.knowledgeLink}" target="_blank" style="color:#8b5cf6; font-size:0.85rem; text-decoration: underline; font-weight:600;" onclick="event.stopPropagation();">
                   <i data-lucide="external-link" style="width:14px; height:14px; margin-bottom:-2px; margin-right:4px;"></i> View Resource
                 </a>
               </div>` 
            : '<div style="margin-top: 10px; font-size:0.8rem; color:var(--text-muted);">No external links attached.</div>';

        item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <span style="font-weight: 800; color: #8b5cf6; font-size: 1rem; line-height: 1.3;">${productTitle}</span>
                        <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                            <span style="font-size: 0.75rem; background: #f3f4f6; color: #6b7280; padding: 2px 6px; border-radius: 4px; font-weight: 600; white-space: nowrap;">
                                ${publishedYear}
                            </span>
                            <span class="chevron" style="color: var(--text-muted); font-size: 0.8rem;">▼</span>
                        </div>
                    </div>
                    
                    <div class="expand-details hidden" style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed #e2e8f0;">
                        <div style="font-size: 0.85rem; color: var(--text-main); line-height: 1.5; margin-bottom: 10px; font-style: italic;">
                            "${brief}"
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px; font-size: 0.75rem; color: var(--text-muted);">
                            <span><strong>Activity:</strong> ${activityName}</span>
                            <span><strong>Community:</strong> ${communityNames}</span>
                        </div>
                        ${linkHtml}
                    </div>
                </div>
            </div>
        `;

        item.onclick = () => {
             const details = item.querySelector('.expand-details');
             const chevron = item.querySelector('.chevron');
             const isHidden = details.classList.contains('hidden');

             // Close others
             listContainer.querySelectorAll('.expand-details').forEach(d => {
                 if (d !== details) d.classList.add('hidden');
             });
             listContainer.querySelectorAll('.chevron').forEach(c => {
                 if (c !== chevron) c.innerText = '▼';
             });

             if (isHidden) {
                 details.classList.remove('hidden');
                 chevron.innerText = '▲';
                 highlightCommunities(a.communityIds, true);
             } else {
                 details.classList.add('hidden');
                 chevron.innerText = '▼';
                 resetHighlights();
             }
        };
        
        listContainer.appendChild(item);
    });
    
    if (window.lucide) window.lucide.createIcons();
}

// ===== COMMUNITY MAPS MODAL LOGIC =====
let communityMapInstance = null;
let communityMapMarkersGroup = null;

const communityMapsBtn = document.getElementById('community-maps-btn');
const communityMapsModal = document.getElementById('community-maps-modal');
const closeCommunityMapsModal = document.getElementById('close-community-maps-modal');
const commMapFilterCountry = document.getElementById('comm-map-filter-country');
const commMapFilterCommunity = document.getElementById('comm-map-filter-community');
const commMapRefreshBtn = document.getElementById('comm-map-refresh-btn');

const commMapPrintBtn = document.getElementById('comm-map-print-btn');

if (communityMapsBtn) {
    communityMapsBtn.addEventListener('click', () => {
        communityMapsModal.classList.remove('hidden');
        initCommunityMap();
        
        // Set Default: Badhupuruwa from Nepal
        if (commMapFilterCountry) commMapFilterCountry.value = "Nepal";
        populateCommMapFilters(false); // Update community list for Nepal
        if (commMapFilterCommunity) commMapFilterCommunity.value = "c_01";
        
        renderCommunityMap(false); // Initial render without animation
    });
}

if (closeCommunityMapsModal) {
    closeCommunityMapsModal.addEventListener('click', () => {
        communityMapsModal.classList.add('hidden');
    });
}

if (commMapPrintBtn) {
    commMapPrintBtn.addEventListener('click', () => {
        // Prepare map for print
        if (communityMapInstance) {
            communityMapInstance.closePopup(); // Close any open popup before printing
            communityMapInstance.invalidateSize();
        }
        
        setTimeout(() => {
            window.print();
        }, 500); 
    });
}

if (commMapRefreshBtn) {
    commMapRefreshBtn.addEventListener('click', () => renderCommunityMap(true)); // Animate on refresh
}

if (commMapFilterCountry) {
    commMapFilterCountry.addEventListener('change', () => {
        populateCommMapFilters(false); // Update community list based on country
        renderCommunityMap(true); // Animate on filter change
    });
}

if (commMapFilterCommunity) {
    commMapFilterCommunity.addEventListener('change', () => renderCommunityMap(true)); // Animate on filter change
}

window.openCommunityMapFor = function(communityId) {
    const community = communitiesData.find(c => c.id === communityId);
    if (!community) return;

    // Show modal
    communityMapsModal.classList.remove('hidden');
    
    // Initialize map
    initCommunityMap();
    
    // Set filters
    if (commMapFilterCountry) commMapFilterCountry.value = community.country;
    populateCommMapFilters(false); // Update community list for this country
    if (commMapFilterCommunity) commMapFilterCommunity.value = community.id;
    
    // Render and handle centering with sidebar padding
    renderCommunityMap(true); // Animate when opened for a specific community
    
    // Use fitBounds with custom padding to ensure markers are centered in the visible map area
    // The sidebar is 20% on desktop (flex). Leaflet is in the 80% div.
    // If we want it centered perfectly, we can use padding to adjust fitBounds.
};

function initCommunityMap() {
    if (communityMapInstance) {
        setTimeout(() => communityMapInstance.invalidateSize(), 100);
        return;
    }

    communityMapInstance = L.map('comm-map-leaflet').setView([28.3949, 84.1240], 7);
    L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; <a href="https://maps.google.com">Google Maps</a>'
    }).addTo(communityMapInstance);

    // Scale Bar
    L.control.scale({ position: 'bottomleft' }).addTo(communityMapInstance);

    communityMapMarkersGroup = L.layerGroup().addTo(communityMapInstance);
    
    // Fix for Leaflet in hidden modals
    setTimeout(() => communityMapInstance.invalidateSize(), 200);
}

function populateCommMapFilters(resetCountry = true) {
    if (!commMapFilterCommunity) return;

    // Get IDs of communities that have resources
    const validCommIds = (window.resourcesData || []).map(r => r.communityId);
    
    const selectedCountry = commMapFilterCountry.value;
    
    let filteredComms = communitiesData.filter(c => validCommIds.includes(c.id));
    
    if (selectedCountry !== "All") {
        filteredComms = filteredComms.filter(c => c.country === selectedCountry);
    }

    let html = '<option value="All">All Communities</option>';
    filteredComms.sort((a,b) => a.name.localeCompare(b.name)).forEach(c => {
        html += `<option value="${c.id}">${c.name}</option>`;
    });
    commMapFilterCommunity.innerHTML = html;
}

function renderCommunityMap(animate = true) {
    if (!communityMapInstance || !communityMapMarkersGroup) return;

    communityMapMarkersGroup.clearLayers();
    const selectedCountry = commMapFilterCountry.value;
    const selectedCommId = commMapFilterCommunity.value;

    const resources = window.resourcesData || [];
    let markersToShow = [];

    resources.forEach(commResource => {
        const commInfo = communitiesData.find(c => c.id === commResource.communityId);
        if (!commInfo) return;

        // Apply Country Filter
        if (selectedCountry !== "All" && commInfo.country !== selectedCountry) return;

        // Apply Community Filter
        if (selectedCommId !== "All" && commInfo.id !== selectedCommId) return;

        // Add resource markers
        commResource.resources.forEach(res => {
            const iconFile = getResourceIcon(res.type);
            const marker = L.marker([res.lat, res.lng], {
                resType: res.type, // Store type for highlighting
                icon: L.divIcon({
                    className: 'resource-marker',
                    html: `<div style="width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                             <img src="${iconFile}" class="resource-icon-print" style="width: 24px; height: 24px;" onerror="this.src='https://unpkg.com/lucide-static@latest/icons/map-pin.svg';">
                           </div>`,
                    iconSize: [28, 28],
                    iconAnchor: [14, 14]
                })
            });
            
            marker.bindPopup(`
                <div style="font-family: inherit; padding: 5px;">
                    <strong style="color: #10b981;">${res.name}</strong>
                    ${res.description ? `<br><span style="font-size: 0.85rem; color: #475569; margin-top: 4px; display: block;">${res.description}</span>` : ''}
                </div>
            `);
            
            communityMapMarkersGroup.addLayer(marker);
            markersToShow.push([res.lat, res.lng]);
        });
    });

    if (markersToShow.length > 0) {
        if (animate) {
            communityMapInstance.flyToBounds(L.latLngBounds(markersToShow), { padding: [50, 50], maxZoom: 15 });
        } else {
            communityMapInstance.fitBounds(L.latLngBounds(markersToShow), { padding: [50, 50], maxZoom: 15 });
        }
    } else if (selectedCommId !== "All") {
        const comm = communitiesData.find(c => c.id === selectedCommId);
        if (comm) {
            if (comm.extent) {
                const b = L.latLngBounds([[comm.extent.n, comm.extent.w], [comm.extent.s, comm.extent.e]]);
                if (animate) {
                    communityMapInstance.flyToBounds(b, { padding: [50, 50], maxZoom: 15 });
                } else {
                    communityMapInstance.fitBounds(b, { padding: [50, 50], maxZoom: 15 });
                }
            } else {
                if (animate) {
                    communityMapInstance.flyTo(comm.coords, 15);
                } else {
                    communityMapInstance.setView(comm.coords, 15);
                }
            }
        }
    } else if (selectedCountry !== "All") {
        const country = countriesData.find(c => c.name === selectedCountry);
        if (country) {
            if (animate) {
                communityMapInstance.flyTo(country.center, country.zoom || 8);
            } else {
                communityMapInstance.setView(country.center, country.zoom || 8);
            }
        }
    } else {
        if (animate) {
            communityMapInstance.flyTo([28.3949, 84.1240], 7);
        } else {
            communityMapInstance.setView([28.3949, 84.1240], 7);
        }
    }

    // Update Legend and Title/Description if needed
    updateCommMapLegend(selectedCommId, selectedCountry);

    if (window.lucide) window.lucide.createIcons();
}

function getResourceIcon(type) {
    if (type.endsWith('.svg')) return 'svg/' + type;
    const map = {
        'School': 'svg/school.svg',
        'Hospital': 'svg/health.svg',
        'Health Post': 'svg/health.svg',
        'Police': 'svg/police.svg',
        'Bridge': 'svg/bridge.svg',
        'Culvert': 'svg/culvert.svg',
        'Ward Office': 'svg/wardoffice.svg',
        'Community Center': 'svg/wardoffice.svg',
        'Safe Shelter': 'svg/safeshelter.svg',
        'Shop': 'svg/shop.svg',
        'Market': 'svg/shop.svg',
        'Hotel': 'svg/shop.svg',
        'Chowk': 'svg/citycenter.svg'
    };
    return map[type] || 'svg/map-pin.svg';
}

function updateCommMapLegend(selectedCommId, selectedCountry) {
    const legendEl = document.getElementById('comm-map-legend');
    const titleEl = document.getElementById('comm-map-details-title');
    if (!legendEl) return;

    const resources = window.resourcesData || [];
    const uniqueTypes = new Set();
    
    let activeCommName = "Community Resources Map";

    resources.forEach(commResource => {
        const commInfo = communitiesData.find(c => c.id === commResource.communityId);
        if (!commInfo) return;

        if (selectedCountry !== "All" && commInfo.country !== selectedCountry) return;
        if (selectedCommId !== "All" && commInfo.id !== selectedCommId) return;

        commResource.resources.forEach(res => {
            uniqueTypes.add(res.type);
        });
    });

    const modalTitleEl = document.getElementById('comm-maps-modal-title');
    const modalSubtitleEl = document.getElementById('comm-maps-modal-subtitle');
    if (modalTitleEl) {
        if (selectedCommId !== "All") {
            const comm = communitiesData.find(c => c.id === selectedCommId);
            modalTitleEl.innerText = comm ? `Community Map: ${comm.name}` : "Community Map";
            if (modalSubtitleEl) {
                if (comm) {
                    const locParts = [comm.municipality, comm.district, comm.province, comm.country].filter(Boolean);
                    modalSubtitleEl.innerText = locParts.join(', ');
                } else {
                    modalSubtitleEl.innerText = "";
                }
            }
        } else if (selectedCountry !== "All") {
            modalTitleEl.innerText = `Country Map: ${selectedCountry}`;
            if (modalSubtitleEl) modalSubtitleEl.innerText = "";
        } else {
            modalTitleEl.innerText = "Global Resources Map";
            if (modalSubtitleEl) modalSubtitleEl.innerText = "";
        }
    }

    if (titleEl) {
        titleEl.innerText = activeCommName;
    }

    let legendHtml = '';
    uniqueTypes.forEach(type => {
        const iconFile = getResourceIcon(type);
        const label = type.replace('.svg', '').replace(/([A-Z])/g, ' $1').trim().replace(/^\w/, c => c.toUpperCase());
        legendHtml += `
            <div class="legend-item-clickable" 
                 onclick="highlightMapResourcesByCategory('${type}', this)"
                 style="display: flex; align-items: center; gap: 10px; font-size: 0.75rem; color: #475569; padding: 4px 6px; cursor: pointer; border-radius: 6px; transition: background 0.2s;">
                <div style="width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <img src="${iconFile}" class="resource-icon-print" style="width: 20px; height: 20px;" onerror="this.src='https://unpkg.com/lucide-static@latest/icons/map-pin.svg';">
                </div>
                <span>${label}</span>
            </div>
        `;
    });

    if (uniqueTypes.size === 0) {
        legendHtml = '<div style="font-size: 0.7rem; color: #94a3b8; font-style: italic;">No resources found for selection.</div>';
    }

    legendEl.innerHTML = legendHtml;
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
if (typeof initData === 'function') {
    initData();
}

window.highlightMapResourcesByCategory = function(category, element) {
    if (!communityMapInstance || !communityMapMarkersGroup) return;

    // Toggle active state on legend item
    const wasActive = element.classList.contains('legend-active');
    document.querySelectorAll('.legend-item-clickable').forEach(el => el.classList.remove('legend-active'));
    
    // Always close existing popups when switching categories
    communityMapInstance.closePopup();

    if (wasActive) {
        // Reset all markers
        communityMapMarkersGroup.eachLayer(layer => {
            if (layer instanceof L.Marker) {
                const icon = layer.getElement();
                if (icon) icon.classList.remove('resource-dimmed', 'resource-highlighted');
            }
        });
        return;
    }

    element.classList.add('legend-active');
    
    const bounds = communityMapInstance.getBounds();
    let firstMarkerToOpen = null;
    
    communityMapMarkersGroup.eachLayer(layer => {
        if (layer instanceof L.Marker && layer.options.resType) {
            const icon = layer.getElement();
            if (!icon) return;

            const isMatch = layer.options.resType === category;
            const inExtent = bounds.contains(layer.getLatLng());

            if (isMatch && inExtent) {
                icon.classList.remove('resource-dimmed');
                icon.classList.add('resource-highlighted');
                if (!firstMarkerToOpen) firstMarkerToOpen = layer;
            } else {
                icon.classList.add('resource-dimmed');
                icon.classList.remove('resource-highlighted');
            }
        }
    });

    // Auto-open the popup for the first matching marker in view
    if (firstMarkerToOpen) {
        firstMarkerToOpen.openPopup();
    }
};

// Handle map resizing on mobile layout shifts
window.addEventListener('resize', () => {
    if (typeof map !== 'undefined' && map) {
        map.invalidateSize();
    }
    if (communityMapInstance) {
        communityMapInstance.invalidateSize();
    }
});
