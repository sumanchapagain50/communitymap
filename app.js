/*************************************************
 * COMMUNITY DATA
 *************************************************/
const COMMUNITY_DATA = {
  nepal: {
    communities: [
      {
        id: "NP_001",
        name: "Rajapur",
        coords: [28.2, 81.7],
        demographics: { population: 3450, households: 620, femalePercent: 52 },
        scores: { floodRisk: 4.2, adaptiveCapacity: 3.5, earlyWarning: 4.0 }
      },
      {
        id: "NP_002",
        name: "Tikapur",
        coords: [28.5, 81.1],
        demographics: { population: 4120, households: 710, femalePercent: 51 },
        scores: { floodRisk: 3.8, adaptiveCapacity: 3.9, earlyWarning: 4.1 }
      }
    ]
  },

  kenya: {
    communities: [
      {
        id: "KE_001",
        name: "Garissa",
        coords: [-0.45, 39.65],
        demographics: { population: 2890, households: 480, femalePercent: 49 },
        scores: { floodRisk: 3.2, adaptiveCapacity: 3.1, earlyWarning: 2.8 }
      }
    ]
  }
};

/*************************************************
 * MAP INITIALIZATION
 *************************************************/
const map = L.map('map', { worldCopyJump: true }).setView([20,0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
  attribution:'&copy; OpenStreetMap contributors'
}).addTo(map);

let communityLayer = null;
let selectedMarker = null;
let showLabels = false;
let voiceEnabled = false;
let permanentTooltips = [];

/*************************************************
 * HELPER: COLOR BY FLOOD RISK
 *************************************************/
function getMarkerColor(score){
  if(score >= 4) return '#dc2626';
  if(score >= 3) return '#f59e0b';
  return '#10b981';
}

/*************************************************
 * LOAD COMMUNITIES AND CREATE SIDEBAR TABS
 *************************************************/
function loadCommunities(countryKey){
  if(communityLayer) map.removeLayer(communityLayer);
  permanentTooltips.forEach(t=>map.removeLayer(t));
  permanentTooltips = [];

  const country = COMMUNITY_DATA[countryKey];
  if(!country) return;

  communityLayer = L.layerGroup().addTo(map);
  const bounds = L.latLngBounds();

  const tabsContainer = document.getElementById('communityTabs');
  tabsContainer.innerHTML = '';

  country.communities.forEach(community=>{
    const latlng = L.latLng(community.coords);
    bounds.extend(latlng);

    const color = getMarkerColor(community.scores.floodRisk);

    const marker = L.circleMarker(latlng,{
      radius: 8,
      fillColor: color,
      color: '#333',
      weight: 1,
      fillOpacity: 0.9
    }).addTo(communityLayer);

    marker.bindTooltip(community.name,{sticky:true,direction:'top'});

    // Click marker opens popup + voice
    marker.on('click', ()=>{
      openCommunityPopup(community,marker);
      highlightMarker(marker);

      if(voiceEnabled && 'speechSynthesis' in window){
        const msg = new SpeechSynthesisUtterance(community.name);
        window.speechSynthesis.speak(msg);
      }

      // Activate corresponding sidebar tab
      document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
      document.getElementById('tab-'+community.id)?.classList.add('active');
    });

    // Permanent labels
    if(showLabels){
      const tooltip = L.tooltip({
        permanent:true,
        direction:'top',
        className:'permanent-tooltip'
      }).setContent(community.name).setLatLng(latlng);
      tooltip.addTo(map);
      permanentTooltips.push(tooltip);
    }

    // Create sidebar tab
    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.id = 'tab-' + community.id;
    tab.textContent = community.name;
    tab.onclick = ()=>{
      map.flyTo(latlng,10,{duration:1.5});
      openCommunityPopup(community,marker);
      highlightMarker(marker);

      if(voiceEnabled && 'speechSynthesis' in window){
        const msg = new SpeechSynthesisUtterance(community.name);
        window.speechSynthesis.speak(msg);
      }

      document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
    }
    tabsContainer.appendChild(tab);
  });

  // Fly to bounds
  setTimeout(()=>{
    if(country.communities.length === 1){
      map.flyTo(bounds.getCenter(),10,{duration:1.5});
    } else {
      map.flyToBounds(bounds,{padding:[50,50],duration:1.5,maxZoom:12});
    }
  },100);
}

/*************************************************
 * HIGHLIGHT SELECTED MARKER
 *************************************************/
function highlightMarker(marker){
  if(selectedMarker) selectedMarker.setStyle({radius:8});
  marker.setStyle({radius:12});
  selectedMarker = marker;
}

/*************************************************
 * POPUP
 *************************************************/
function openCommunityPopup(community,layer){
  const html = `
    <div class="popup">
      <div class="popup-tabs">
        <button class="active" onclick="switchTab(event,'demo')">Demographics</button>
        <button onclick="switchTab(event,'score')">Scoresheet</button>
      </div>
      <div id="demo" class="popup-content">
        <strong>${community.name}</strong><br/>
        Population: ${community.demographics.population}<br/>
        Households: ${community.demographics.households}<br/>
        Female (%): ${community.demographics.femalePercent}
      </div>
      <div id="score" class="popup-content hidden">
        <div class="score">Flood Risk: ${community.scores.floodRisk}/5</div>
        <div class="score">Adaptive Capacity: ${community.scores.adaptiveCapacity}/5</div>
        <div class="score">Early Warning: ${community.scores.earlyWarning}/5</div>
      </div>
    </div>
  `;
  layer.bindPopup(html,{maxWidth:350}).openPopup();
}

/*************************************************
 * POPUP TAB SWITCH
 *************************************************/
window.switchTab = function(event,tabId){
  const popup = event.target.closest('.leaflet-popup-content');
  popup.querySelectorAll('.popup-content').forEach(el=>el.classList.add('hidden'));
  popup.querySelectorAll('button').forEach(btn=>btn.classList.remove('active'));
  popup.querySelector(`#${tabId}`).classList.remove('hidden');
  event.target.classList.add('active');
}

/*************************************************
 * UPDATE LABELS
 *************************************************/
function updateLabels(){
  permanentTooltips.forEach(t=>map.removeLayer(t));
  permanentTooltips = [];
  if(!showLabels || !communityLayer) return;

  communityLayer.eachLayer(marker=>{
    const tooltip = L.tooltip({
      permanent:true,
      direction:'top',
      className:'permanent-tooltip'
    }).setContent(marker.getTooltip().getContent())
      .setLatLng(marker.getLatLng());
    tooltip.addTo(map);
    permanentTooltips.push(tooltip);
  });
}

/*************************************************
 * SIDEBAR EVENTS
 *************************************************/
document.getElementById('countrySelect').addEventListener('change',e=>{
  loadCommunities(e.target.value);
});

document.getElementById('communitySearch').addEventListener('input',e=>{
  const filter = e.target.value.toLowerCase();
  document.querySelectorAll('.tab').forEach(tab=>{
    tab.style.display = tab.textContent.toLowerCase().includes(filter)?'block':'none';
  });
});

document.getElementById('labelToggle').addEventListener('change', e=>{
  showLabels = e.target.checked;
  updateLabels();
});

document.getElementById('voiceToggle').addEventListener('change', e=>{
  voiceEnabled = e.target.checked;
});
