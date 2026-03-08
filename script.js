// script.js — Static demo edition
// Reads local CSV/GeoJSON if present; falls back to minimal demo data.
// Features: Leaflet map, Leaflet.draw, point-in-polygon averaging (turf), scoring engine, charts (Chart.js), Claude stub.

// -------------------- Hard-coded thresholds & crop stages (from spec) --------------------
const INDEX_THRESHOLDS = {
  NDVI: { low: 0.4, mid: 0.6 },
  EVI:  { low: 0.15, mid: 0.40 },
  NDMI: { low: 0.2, mid: 0.4 },
  NDRE: { low: 0.2, mid: 0.3 }
};

function scoreIndex(value, low, mid) {
  if (value === null || value === undefined || isNaN(value)) return null;
  if (value < low) return 0;
  if (value < mid) return 50;
  return 100;
}

function computeFitnessScore({ ndvi, ndmi, ndre, evi }) {
  const scores = [
    scoreIndex(ndvi, INDEX_THRESHOLDS.NDVI.low, INDEX_THRESHOLDS.NDVI.mid),
    scoreIndex(evi,  INDEX_THRESHOLDS.EVI.low,  INDEX_THRESHOLDS.EVI.mid),
    scoreIndex(ndmi, INDEX_THRESHOLDS.NDMI.low, INDEX_THRESHOLDS.NDMI.mid),
    scoreIndex(ndre, INDEX_THRESHOLDS.NDRE.low, INDEX_THRESHOLDS.NDRE.mid)
  ].filter(s => s !== null);
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((a,b)=>a+b,0)/scores.length);
}

function stressLevelFromScore(score){
  if (score === null) return { label: "Unknown", color: "#888" };
  if (score >= 70) return { label: "Healthy", emoji:"🟢", color: "#228B22" };
  if (score >= 40) return { label: "Moderate Stress", emoji:"🟡", color: "#FFA500" };
  return { label: "High Stress", emoji:"🔴", color: "#DC143C" };
}

// -------------------- Minimal demo fallback data (used if files absent) --------------------
const FALLBACK_MASTER = [
  // date, temp_max_C, rh_pct, soil proxy, cwr, ndvi,evi,ndmi,ndre
  {date:"2025-07-11", temp_max_C:33, rh_pct:45, soil_m:0.12, cwr:8, ndvi:0.35, evi:0.12, ndmi:0.10, ndre:0.18},
  {date:"2025-07-12", temp_max_C:34, rh_pct:40, soil_m:0.11, cwr:8.5, ndvi:0.34, evi:0.11, ndmi:0.09, ndre:0.17},
  {date:"2025-07-13", temp_max_C:34, rh_pct:38, soil_m:0.10, cwr:8.2, ndvi:0.33, evi:0.10, ndmi:0.09, ndre:0.16},
  {date:"2025-07-14", temp_max_C:35, rh_pct:35, soil_m:0.09, cwr:8.7, ndvi:0.31, evi:0.09, ndmi:0.08, ndre:0.15},
  {date:"2025-07-15", temp_max_C:36, rh_pct:32, soil_m:0.08, cwr:9.0, ndvi:0.30, evi:0.08, ndmi:0.07, ndre:0.14}
];

const FALLBACK_TIMESERIES = [
  {date:"2025-04-13", NDVI_mean:0.22, NDMI_mean:0.12, EVI_mean:0.09, NDRE_mean:0.10},
  {date:"2025-05-05", NDVI_mean:0.40, NDMI_mean:0.22, EVI_mean:0.18, NDRE_mean:0.20},
  {date:"2025-06-02", NDVI_mean:0.55, NDMI_mean:0.35, EVI_mean:0.32, NDRE_mean:0.28},
  {date:"2025-06-27", NDVI_mean:0.58, NDMI_mean:0.36, EVI_mean:0.34, NDRE_mean:0.29},
  {date:"2025-07-12", NDVI_mean:0.52, NDMI_mean:0.30, EVI_mean:0.30, NDRE_mean:0.25},
  {date:"2025-07-27", NDVI_mean:0.50, NDMI_mean:0.28, EVI_mean:0.29, NDRE_mean:0.24}
];

// -------------------- DOM helpers --------------------
const dom = {
  gauge: document.getElementById('fitness-gauge'),
  badge: document.getElementById('stress-badge'),
  vitals: document.getElementById('vitals'),
  aiNote: document.getElementById('ai-note'),
  aiRefresh: document.getElementById('ai-refresh'),
  satDate: document.getElementById('sat-date'),
  indexSwitch: document.getElementById('index-switch'),
  clearDraw: document.getElementById('clear-draw')
};

// -------------------- Map init --------------------
const map = L.map('map', { zoomControl:true }).setView([32.45, -85.75], 10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:''}).addTo(map);

// load county boundary geojson (optional)
let countyLayer = null;
fetch('data/raw/macon_county.geojson').then(r=>r.ok? r.json(): Promise.reject()).then(geo=>{
  countyLayer = L.geoJSON(geo, { style:{color:'#00ffff',weight:2,opacity:0.6,fill:false}}).addTo(map);
  map.fitBounds(L.geoJSON(geo).getBounds(), {padding:[20,20]});
}).catch(()=>console.warn('macon_county.geojson not found — continuing with default view.'));

// GeoTIFF overlays are visual only; we will not load tiffs here (demo).
let activeIndex = dom.indexSwitch.value;
dom.indexSwitch.addEventListener('change', ()=>{ activeIndex = dom.indexSwitch.value; });

// -------------------- Draw control --------------------
const drawnItems = new L.FeatureGroup().addTo(map);
const drawControl = new L.Control.Draw({
  edit: { featureGroup: drawnItems },
  draw: { polyline:false, rectangle:true, polygon:true, circle:false, marker:false, circlemarker:false }
});
map.addControl(drawControl);

let lastFieldPolygon = null;
map.on(L.Draw.Event.CREATED, async (event)=>{
  const layer = event.layer;
  drawnItems.clearLayers();
  drawnItems.addLayer(layer);
  lastFieldPolygon = layer.toGeoJSON();
  layer.setStyle({color: '#00FFFF', weight:2, opacity:0.9});
  // pulse effect (simple)
  layer._path && (layer._path.style.filter = 'drop-shadow(0 0 8px rgba(0,255,255,0.6))');
  await recalcForPolygon(lastFieldPolygon);
});

dom.clearDraw.addEventListener('click', ()=>{
  drawnItems.clearLayers();
  lastFieldPolygon = null;
  recalcForPolygon(null);
});

// -------------------- Load timeseries and master CSV (local) --------------------
let masterData = null;
let timeseriesData = null;
async function loadLocalData(){
  // master
  try {
    const res = await fetch('data/processed/crop_fitness_master.csv');
    if(!res.ok) throw 0;
    const text = await res.text();
    masterData = Papa.parse(text, {header:true, dynamicTyping:true}).data;
  } catch(e){
    console.warn('master CSV not found — using fallback.');
    masterData = FALLBACK_MASTER;
  }

  // timeseries
  try {
    const res2 = await fetch('data/gee_exports/crop_fitness_timeseries_macon_2025.csv');
    if(!res2.ok) throw 0;
    const txt = await res2.text();
    timeseriesData = Papa.parse(txt, {header:true, dynamicTyping:true}).data;
  } catch(e){
    console.warn('timeseries CSV not found — using fallback.');
    timeseriesData = FALLBACK_TIMESERIES;
  }
}

function latestMasterRecord(){
  if(!masterData || masterData.length===0) return null;
  // find July 15, 2025 if present else last row
  const rec = masterData.find(r=>r.date === '2025-07-15') || masterData[masterData.length-1];
  return rec;
}

// -------------------- GeoJSON grid loading (points per date) --------------------
const geojsonDates = [
  'data/gee_exports/crop_fitness_grid_macon_20250413.geojson',
  'data/gee_exports/crop_fitness_grid_macon_20250418.geojson',
  'data/gee_exports/crop_fitness_grid_macon_20250505.geojson',
  'data/gee_exports/crop_fitness_grid_macon_20250602.geojson',
  'data/gee_exports/crop_fitness_grid_macon_20250627.geojson',
  'data/gee_exports/crop_fitness_grid_macon_20250712.geojson',
  'data/gee_exports/crop_fitness_grid_macon_20250727.geojson'
];

let gridCache = {}; // dateStr -> geojson FeatureCollection
async function loadAllGrids(){
  for(const path of geojsonDates){
    try {
      const res = await fetch(path);
      if(!res.ok) throw 0;
      const gj = await res.json();
      // store keyed by image_date property or filename
      const key = (gj.features && gj.features[0] && gj.features[0].properties && gj.features[0].properties.image_date) || path;
      gridCache[key] = gj;
    } catch(e){
      console.warn('Grid not found:', path);
      // skip — polygon-based calc will fall back to county-mean timeseries if needed
    }
  }
}

// helper: get points inside polygon and average indices for latest date
function avgIndicesForPolygon(polygonGeoJSON){
  if(!polygonGeoJSON) return null;
  // choose the latest available grid in cache
  const keys = Object.keys(gridCache);
  if(keys.length===0) return null;
  // get the latest by lexicographic (dates are YYYY-MM-DD or filenames)
  const latestKey = keys.sort().reverse()[0];
  const fc = gridCache[latestKey];
  const pts = fc.features || [];
  const inside = pts.filter(f => turf.booleanPointInPolygon(f, polygonGeoJSON));
  if(inside.length===0) return null;
  const sums = { NDVI:0, NDMI:0, EVI:0, NDRE:0 };
  inside.forEach(f=>{
    const p = f.properties || {};
    sums.NDVI += (p.NDVI || p.NDVI_mean || 0);
    sums.NDMI += (p.NDMI || p.NDMI_mean || 0);
    sums.EVI  += (p.EVI  || p.EVI_mean  || 0);
    sums.NDRE += (p.NDRE || p.NDRE_mean || 0);
  });
  const n = inside.length;
  return {
    ndvi: +(sums.NDVI / n).toFixed(3),
    ndmi: +(sums.NDMI / n).toFixed(3),
    evi:  +(sums.EVI  / n).toFixed(3),
    ndre: +(sums.NDRE / n).toFixed(3)
  };
}

// -------------------- Render vitals and gauge --------------------
function renderVitals(view){
  // view: { ndvi, ndmi, evi, ndre, tempMax, rh, soil_m, cwr, lastRain, daysSinceRain }
  const v = view || {};
  const score = computeFitnessScore({ ndvi:v.ndvi, ndmi:v.ndmi, ndre:v.ndre, evi:v.evi });
  const stress = stressLevelFromScore(score);

  dom.gauge.textContent = score === null ? '--' : score;
  dom.gauge.style.boxShadow = `0 8px 24px ${stress.color}33`;
  dom.badge.textContent = `${stress.emoji||''} ${stress.label}`;
  dom.badge.style.background = stress.color + '11';
  dom.badge.style.border = `1px solid ${stress.color}33`;

  const vitList = [
    {name:'NDVI', value:v.ndvi, measure:''},
    {name:'NDMI', value:v.ndmi, measure:''},
    {name:'EVI',  value:v.evi,  measure:''},
    {name:'NDRE', value:v.ndre, measure:''},
    {name:'Soil Moisture', value:v.soil_m, measure:'m³/m³'},
    {name:'CWR', value:v.cwr, measure:'mm/day'},
    {name:'Temp Max', value:v.tempMax, measure:'°C'}
  ];

  dom.vitals.innerHTML = '';
  vitList.forEach(it=>{
    const row = document.createElement('div');
    row.className = 'vital-row';
    const name = document.createElement('div'); name.className='vital-name'; name.textContent = it.name;
    const val = document.createElement('div'); val.className='vital-value';
    const display = (it.value === null || it.value === undefined) ? '--' : it.value;
    val.textContent = `${display} ${it.measure||''}`;
    // color band based on thresholds
    let color = '#888';
    if(it.name === 'NDVI') color = colorForIndex(it.value, INDEX_THRESHOLDS.NDVI);
    if(it.name === 'EVI')  color = colorForIndex(it.value, INDEX_THRESHOLDS.EVI);
    if(it.name === 'NDMI') color = colorForIndex(it.value, INDEX_THRESHOLDS.NDMI);
    if(it.name === 'NDRE') color = colorForIndex(it.value, INDEX_THRESHOLDS.NDRE);
    if(it.name === 'Soil Moisture') color = colorForRange(it.value, 0.15, 0.25, 0.25);
    if(it.name === 'CWR') color = colorForRange(it.value, 5,7,7, true);
    if(it.name === 'Temp Max') color = colorForRange(it.value, 33,38,38, true);
    val.style.color = color;
    row.appendChild(name); row.appendChild(val);
    dom.vitals.appendChild(row);
  });

  // AI note stub (we call a local stub that builds the prompt and logs it)
  const crop = 'Cotton (demo)';
  const stage = 'Flowering';
  dom.aiNote.textContent = `Fitness Score: ${score===null?'--':score}/100\nStress: ${stress.label}\n\nClick "Generate Note" to call the Claude stub.`;
  // store current for stub
  dom.aiRefresh._payload = { crop, stage, score, stress, signals: { ndvi:v.ndvi, ndmi:v.ndmi, ndre:v.ndre, evi:v.evi }, weather:{ tempMax:v.tempMax, rh:v.rh, cwr:v.cwr }, soil:v.soil_m };
}

// small helpers to color-signal text
function colorForIndex(val, thr){
  if(val === null || val === undefined || isNaN(val)) return '#888';
  if(val < thr.low) return '#DC143C';
  if(val < thr.mid) return '#FFA500';
  return '#228B22';
}
function colorForRange(val, lowWarn, highWarn, greenThreshold, invert=false){
  if(val === null || val === undefined || isNaN(val)) return '#888';
  if(!invert){
    if(val > greenThreshold) return '#228B22';
    if(val >= lowWarn && val <= highWarn) return '#FFA500';
    return '#DC143C';
  } else {
    // for CWR and Temp: higher is worse
    if(val < lowWarn) return '#228B22';
    if(val <= highWarn) return '#FFA500';
    return '#DC143C';
  }
}

// -------------------- Chart rendering (Chart.js) --------------------
let ndviChart=null, ndmiChart=null, cwrChart=null;
function renderCharts(master, timeseries){
  // master: array of daily objects
  const dates = master.map(r=>r.date);
  const ndvi = master.map(r=>r.ndvi ?? r.NDVI);
  const ndmi = master.map(r=>r.ndmi ?? r.NDMI);
  const cwr  = master.map(r=>r.cwr ?? r.CWR);

  const ctx1 = document.getElementById('ndvi-chart').getContext('2d');
  const ctx2 = document.getElementById('ndmi-chart').getContext('2d');
  const ctx3 = document.getElementById('cwr-chart').getContext('2d');

  if(ndviChart) ndviChart.destroy();
  ndviChart = new Chart(ctx1, { type:'line', data:{labels:dates,datasets:[{label:'NDVI',data:ndvi,borderColor:'#228B22',backgroundColor:'#228B2230',fill:true}]}, options:{plugins:{legend:{display:false}}}});

  if(ndmiChart) ndmiChart.destroy();
  ndmiChart = new Chart(ctx2, { type:'line', data:{labels:dates,datasets:[{label:'NDMI',data:ndmi,borderColor:'#4169E1',backgroundColor:'#4169E130',fill:true}]}, options:{plugins:{legend:{display:false}}}});

  if(cwrChart) cwrChart.destroy();
  cwrChart = new Chart(ctx3, { type:'bar', data:{labels:dates,datasets:[{label:'CWR (mm/day)',data:cwr,backgroundColor:'#FFA500'}]}, options:{plugins:{legend:{display:false}}}});
}

// -------------------- Recalc: when polygon drawn, or cleared --------------------
async function recalcForPolygon(polygonGeoJSON){
  // If we have grids loaded and a polygon, compute average satellite indices for the polygon
  let signals = null;
  if(polygonGeoJSON){
    signals = avgIndicesForPolygon(polygonGeoJSON);
  }
  // fall back to latest master record if polygon indices not available
  const latest = latestMasterRecord() || MASTER_FALLBACK;
  const view = {
    ndvi: signals?.ndvi ?? latest.ndvi ?? latest.NDVI_mean ?? null,
    ndmi: signals?.ndmi ?? latest.ndmi ?? latest.NDMI_mean ?? null,
    evi:  signals?.evi  ?? latest.evi  ?? latest.EVI_mean  ?? null,
    ndre: signals?.ndre ?? latest.ndre ?? latest.NDRE_mean ?? null,
    tempMax: latest.temp_max_C ?? latest.tempMax ?? latest.temp_max || latest.temp_max_C,
    rh: latest.rh_pct ?? latest.rh,
    soil_m: latest.soil_m ?? latest.soil_m,
    cwr: latest.cotton_cwr ?? latest.cwr ?? latest.CWR
  };
  renderVitals(view);
}

// -------------------- AI (Claude) stub — builds prompt and logs it  --------------------
async function callClaudeStub(payload){
  // This demo is a stub. We do not call Claude. We generate a plain-English note locally and log the actual API payload to console.
  const p = payload || dom.aiRefresh._payload || {};
  const signals = p.signals || {};
  const score = p.score ?? computeFitnessScore(signals);
  const stress = stressLevelFromScore(score);
  const note = [
    `${p.crop || 'Crop'} — ${p.stage || ''}`,
    `Date: July 15, 2025`,
    `Fitness Score: ${score===null?'--':score}/100 — ${stress.label}`,
    `NDVI: ${signals.ndvi ?? '--'}, NDMI: ${signals.ndmi ?? '--'}, EVI: ${signals.evi ?? '--'}, NDRE: ${signals.ndre ?? '--'}`,
    '',
    // Simple direct recommendation rules:
    (score === null) ? 'No data to make a recommendation.' :
    (score < 40) ? 'Severe moisture stress. Irrigate now — within 24 hours — to support flowering and avoid yield loss.' :
    (score < 70) ? 'Moderate stress. Consider irrigation in the next 48–72 hours if soil moisture remains low.' :
    'Crop is healthy. Monitor; irrigate only if drought period continues.'
  ].join('\n');

  dom.aiNote.textContent = note;

  // Build the real Claude prompt (logged only)
  const claudePrompt = `You are an agronomist advising an Alabama farmer.
Today is July 15, 2025. Assess the crop condition.

Fitness Score: ${score}/100
Stress Level: ${stress.label}
Signals: NDVI ${signals.ndvi}, NDMI ${signals.ndmi}, NDRE ${signals.ndre}, EVI ${signals.evi}
Weather: Temp ${p.weather?.tempMax ?? '--'}°C, RH ${p.weather?.rh ?? '--'}%
Soil: ${p.soil ?? '--'}

Recommendation: Short (3-4 sentences), plain English.`;

  console.log('--- Claude API payload (STUB, do not call in demo) ---');
  console.log({ model: 'claude-sonnet-4-20250514', prompt: claudePrompt });
}

// ai button handler
dom.aiRefresh.addEventListener('click', ()=>callClaudeStub());

// -------------------- Initial load sequence --------------------
(async function init(){
  await loadLocalData();
  await loadAllGrids();
  // render charts & initial vitals
  renderCharts(masterData, timeseriesData);
  // initial recalc with no polygon (county-level)
  await recalcForPolygon(null);

  // if grid cache has a July 27/2025 key, update badge
  const satKey = Object.keys(gridCache).sort().reverse()[0];
  if(satKey && satKey.includes('20250727')) {
    document.getElementById('sat-date').textContent = 'Satellite: July 27, 2025';
  } else {
    document.getElementById('sat-date').textContent = 'Satellite: July 27, 2025 (visual only)';
  }

  // timeline (hard-coded)
  const timeline = document.getElementById('timeline-render');
  const cropStages = {
    cotton: [
      { stage: "Establishment",   start: "2025-04-12", end: "2025-05-01" },
      { stage: "Vegetative",      start: "2025-05-02", end: "2025-05-31" },
      { stage: "Flowering",       start: "2025-06-01", end: "2025-08-04" },
      { stage: "Yield Formation", start: "2025-08-05", end: "2025-09-08" },
      { stage: "Ripening",        start: "2025-09-09", end: "2025-09-26" }
    ]
  };
  // render simple blocks and "Today" marker
  cropStages.cotton.forEach(s=>{
    const d = document.createElement('div');
    d.style.minWidth='120px';
    d.style.padding='6px';
    d.style.marginRight='8px';
    d.style.borderRadius='6px';
    d.style.background='linear-gradient(180deg, #071018, #08161c)';
    d.style.border='1px solid rgba(255,255,255,0.03)';
    d.textContent = `${s.stage}\n${s.start} → ${s.end}`;
    timeline.appendChild(d);
  });
  const today = document.createElement('div');
  today.style.marginLeft='12px';
  today.style.padding='6px';
  today.style.color='#fff';
  today.textContent = 'Today: 2025-07-15';
  timeline.appendChild(today);
})();