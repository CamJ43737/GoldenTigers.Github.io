// ═══════════════════════════════════════════════════════════════
// CROP FITNESS TRACKER — script.js
// Light theme | GeoTIFF imagery | Crop selector | Date slider
// ECG sparklines | Point-in-polygon | Season complete logic
// ═══════════════════════════════════════════════════════════════

// ── THRESHOLDS ──────────────────────────────────────────────────
const INDEX_THRESHOLDS = {
  NDVI: { low: 0.4,  mid: 0.6  },
  EVI:  { low: 0.15, mid: 0.40 },
  NDMI: { low: 0.2,  mid: 0.4  },
  NDRE: { low: 0.2,  mid: 0.3  }
};

// ── GEOTIFF PATHS & COLOR SCALES ────────────────────────────────
const TIFF_PATHS = {
  NDVI: 'data/gee_exports/macon_ndvi_20250727.tif',
  NDMI: 'data/gee_exports/macon_ndmi_20250727.tif',
  EVI:  'data/gee_exports/macon_evi_20250727.tif',
  NDRE: 'data/gee_exports/macon_ndre_20250727.tif'
};

// Color scales for each index (value → CSS color)
function ndviColor(v) {
  if (v === null || isNaN(v) || v <= 0) return null; // transparent
  if (v < 0.2)  return '#8B4513';
  if (v < 0.35) return '#c8a44a';
  if (v < 0.5)  return '#d4c84a';
  if (v < 0.65) return '#7ab317';
  return '#006400';
}
function ndmiColor(v) {
  if (v === null || isNaN(v)) return null;
  if (v < -0.2) return '#8B2500';
  if (v < 0)    return '#d45a00';
  if (v < 0.1)  return '#f5f5f5';
  if (v < 0.3)  return '#6699cc';
  return '#00008B';
}
function eviColor(v) {
  if (v === null || isNaN(v) || v <= 0) return null;
  if (v < 0.1)  return '#F5DEB3';
  if (v < 0.25) return '#c8d44a';
  if (v < 0.4)  return '#9ACD32';
  return '#228B22';
}
function ndreColor(v) {
  if (v === null || isNaN(v)) return null;
  if (v < 0.1)  return '#800080';
  if (v < 0.2)  return '#cc6600';
  if (v < 0.3)  return '#FFA500';
  return '#00cc44';
}

const INDEX_COLOR_FN = { NDVI: ndviColor, NDMI: ndmiColor, EVI: eviColor, NDRE: ndreColor };

// Legend gradient stops per index
const LEGEND_GRADIENTS = {
  NDVI: 'linear-gradient(to right, #8B4513, #d4c84a, #006400)',
  NDMI: 'linear-gradient(to right, #8B2500, #f5f5f5, #00008B)',
  EVI:  'linear-gradient(to right, #F5DEB3, #9ACD32, #228B22)',
  NDRE: 'linear-gradient(to right, #800080, #FFA500, #00cc44)'
};

// ── CROP & STAGE DATA ───────────────────────────────────────────
const SEASON_END = {
  cotton:  '2025-09-26',
  corn:    '2025-07-06',
  soybean: '2025-08-30'
};

const CROP_STAGES = {
  cotton: [
    { stage:'Establishment',   start:'2025-04-12', end:'2025-05-01', bg:'#e8f5e8', color:'#2d6a2d' },
    { stage:'Vegetative',      start:'2025-05-02', end:'2025-05-31', bg:'#d4edda', color:'#1e5c1e' },
    { stage:'Flowering',       start:'2025-06-01', end:'2025-08-04', bg:'#fef3e0', color:'#d4860a' },
    { stage:'Yield Formation', start:'2025-08-05', end:'2025-09-08', bg:'#fff0e0', color:'#b8730a' },
    { stage:'Ripening',        start:'2025-09-09', end:'2025-09-26', bg:'#fdecea', color:'#c0392b' }
  ],
  corn: [
    { stage:'Establishment',   start:'2025-03-05', end:'2025-03-24', bg:'#e8f5e8', color:'#2d6a2d' },
    { stage:'Vegetative',      start:'2025-03-25', end:'2025-04-26', bg:'#d4edda', color:'#1e5c1e' },
    { stage:'Flowering',       start:'2025-04-27', end:'2025-05-14', bg:'#fef3e0', color:'#d4860a' },
    { stage:'Yield Formation', start:'2025-05-15', end:'2025-06-23', bg:'#fff0e0', color:'#b8730a' },
    { stage:'Ripening',        start:'2025-06-24', end:'2025-07-06', bg:'#fdecea', color:'#c0392b' }
  ],
  soybean: [
    { stage:'Establishment',   start:'2025-04-30', end:'2025-05-09', bg:'#e8f5e8', color:'#2d6a2d' },
    { stage:'Vegetative',      start:'2025-05-10', end:'2025-06-13', bg:'#d4edda', color:'#1e5c1e' },
    { stage:'Flowering',       start:'2025-06-14', end:'2025-07-13', bg:'#fef3e0', color:'#d4860a' },
    { stage:'Yield Formation', start:'2025-07-14', end:'2025-08-17', bg:'#fff0e0', color:'#b8730a' },
    { stage:'Ripening',        start:'2025-08-18', end:'2025-08-30', bg:'#fdecea', color:'#c0392b' }
  ]
};

const CWR_COL   = { cotton:'cotton_cwr',   corn:'corn_cwr',   soybean:'soybean_cwr'   };
const STAGE_COL = { cotton:'cotton_stage', corn:'corn_stage', soybean:'soybean_stage' };

const GRID_DATE_KEYS = [
  '2025-04-13','2025-04-18','2025-05-05',
  '2025-06-02','2025-06-27','2025-07-12','2025-07-27'
];
const GRID_PATHS = {
  '2025-04-13': 'data/gee_exports/crop_fitness_grid_macon_20250413.geojson',
  '2025-04-18': 'data/gee_exports/crop_fitness_grid_macon_20250418.geojson',
  '2025-05-05': 'data/gee_exports/crop_fitness_grid_macon_20250505.geojson',
  '2025-06-02': 'data/gee_exports/crop_fitness_grid_macon_20250602.geojson',
  '2025-06-27': 'data/gee_exports/crop_fitness_grid_macon_20250627.geojson',
  '2025-07-12': 'data/gee_exports/crop_fitness_grid_macon_20250712.geojson',
  '2025-07-27': 'data/gee_exports/crop_fitness_grid_macon_20250727.geojson'
};

// ── FALLBACK DATA ────────────────────────────────────────────────
const FALLBACK_MASTER = [
  {date:'2025-04-13',temp_max_C:22,rh_pct:72,precip_mm:0,   cotton_cwr:1.2,corn_cwr:1.7, soybean_cwr:null,cotton_stage:'Establishment', corn_stage:'Vegetative',    soybean_stage:null},
  {date:'2025-04-18',temp_max_C:24,rh_pct:68,precip_mm:2,   cotton_cwr:1.4,corn_cwr:2.0, soybean_cwr:null,cotton_stage:'Establishment', corn_stage:'Vegetative',    soybean_stage:null},
  {date:'2025-05-05',temp_max_C:27,rh_pct:65,precip_mm:8,   cotton_cwr:2.1,corn_cwr:3.1, soybean_cwr:1.1, cotton_stage:'Vegetative',   corn_stage:'Flowering',     soybean_stage:'Establishment'},
  {date:'2025-06-02',temp_max_C:31,rh_pct:60,precip_mm:0,   cotton_cwr:3.5,corn_cwr:4.8, soybean_cwr:2.8, cotton_stage:'Flowering',    corn_stage:'Yield Formation',soybean_stage:'Vegetative'},
  {date:'2025-06-27',temp_max_C:34,rh_pct:55,precip_mm:12,  cotton_cwr:4.2,corn_cwr:5.1, soybean_cwr:3.9, cotton_stage:'Flowering',    corn_stage:'Yield Formation',soybean_stage:'Vegetative'},
  {date:'2025-07-12',temp_max_C:36,rh_pct:48,precip_mm:0,   cotton_cwr:5.0,corn_cwr:3.2, soybean_cwr:4.8, cotton_stage:'Flowering',    corn_stage:'Ripening',      soybean_stage:'Flowering'},
  {date:'2025-07-27',temp_max_C:38,rh_pct:42,precip_mm:0,   cotton_cwr:5.4,corn_cwr:null,soybean_cwr:5.2, cotton_stage:'Flowering',    corn_stage:null,            soybean_stage:'Yield Formation'}
];
const FALLBACK_TIMESERIES = [
  {date:'2025-04-13',NDVI_mean:0.22,NDMI_mean:0.12,EVI_mean:0.09,NDRE_mean:0.10},
  {date:'2025-04-18',NDVI_mean:0.30,NDMI_mean:0.18,EVI_mean:0.14,NDRE_mean:0.15},
  {date:'2025-05-05',NDVI_mean:0.40,NDMI_mean:0.22,EVI_mean:0.18,NDRE_mean:0.20},
  {date:'2025-06-02',NDVI_mean:0.55,NDMI_mean:0.35,EVI_mean:0.32,NDRE_mean:0.28},
  {date:'2025-06-27',NDVI_mean:0.58,NDMI_mean:0.36,EVI_mean:0.34,NDRE_mean:0.29},
  {date:'2025-07-12',NDVI_mean:0.52,NDMI_mean:0.30,EVI_mean:0.30,NDRE_mean:0.25},
  {date:'2025-07-27',NDVI_mean:0.48,NDMI_mean:0.26,EVI_mean:0.27,NDRE_mean:0.22}
];
const FALLBACK_SOIL = {
  '2025-04-13':0.261,'2025-04-18':0.109,'2025-05-05':0.180,
  '2025-06-02':0.220,'2025-06-27':0.190,'2025-07-12':0.140,'2025-07-27':0.110
};

// ── STATE ────────────────────────────────────────────────────────
let selectedCrop = 'cotton';
let selectedDate = '2025-07-27';
let selectedIdx  = 'NDVI';
let lastPolygon  = null;

let masterData     = null;
let timeseriesData = null;
let soilData       = {};
let gridCache      = {};
let tiffCache      = {};      // index name -> georaster object
let activeTiffLayer = null;
let charts         = {};

// ── HELPERS ──────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function normaliseDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) return `${slash[3]}-${slash[1].padStart(2,'0')}-${slash[2].padStart(2,'0')}`;
  return s.slice(0, 10);
}

function isSeasonComplete(crop, date) {
  return new Date(date) > new Date(SEASON_END[crop]);
}

// ── SCORING ──────────────────────────────────────────────────────
function scoreIndex(val, low, mid) {
  if (val === null || val === undefined || isNaN(val)) return null;
  if (val < low) return 0;
  if (val < mid) return 50;
  return 100;
}
function computeFitnessScore({ ndvi, ndmi, ndre, evi }) {
  const s = [
    scoreIndex(ndvi, INDEX_THRESHOLDS.NDVI.low, INDEX_THRESHOLDS.NDVI.mid),
    scoreIndex(evi,  INDEX_THRESHOLDS.EVI.low,  INDEX_THRESHOLDS.EVI.mid),
    scoreIndex(ndmi, INDEX_THRESHOLDS.NDMI.low, INDEX_THRESHOLDS.NDMI.mid),
    scoreIndex(ndre, INDEX_THRESHOLDS.NDRE.low, INDEX_THRESHOLDS.NDRE.mid)
  ].filter(v => v !== null);
  if (!s.length) return null;
  return Math.round(s.reduce((a,b)=>a+b,0)/s.length);
}
function stressFromScore(score) {
  if (score === null) return { label:'Unknown',    color:'#a0926e', emoji:'—',  bg:'#f7f4ee', border:'#ddd5c0' };
  if (score >= 70)   return { label:'Healthy',     color:'#2d6a2d', emoji:'🟢', bg:'#e8f5e8', border:'rgba(45,106,45,0.25)' };
  if (score >= 40)   return { label:'Moderate',    color:'#d4860a', emoji:'🟡', bg:'#fef3e0', border:'rgba(212,134,10,0.25)' };
  return               { label:'High Stress', color:'#c0392b', emoji:'🔴', bg:'#fdecea', border:'rgba(192,57,43,0.25)' };
}
function colorForVal(val, low, high, invert=false) {
  if (val === null || val === undefined || isNaN(val)) return '#a0926e';
  if (!invert) {
    if (val >= high) return '#2d6a2d';
    if (val >= low)  return '#d4860a';
    return '#c0392b';
  } else {
    if (val < low)   return '#2d6a2d';
    if (val <= high) return '#d4860a';
    return '#c0392b';
  }
}

// ── MAP ──────────────────────────────────────────────────────────
const map = L.map('map', { zoomControl:true }).setView([32.45, -85.75], 10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution:'© OpenStreetMap', maxZoom:19, opacity:0.7
}).addTo(map);

// county boundary
fetch('data/raw/macon_county.geojson')
  .then(r => r.ok ? r.json() : Promise.reject())
  .then(geo => {
    L.geoJSON(geo, { style:{ color:'#2d6a2d', weight:2.5, opacity:0.7, fill:false }}).addTo(map);
    map.fitBounds(L.geoJSON(geo).getBounds(), { padding:[24,24] });
  })
  .catch(() => console.warn('macon_county.geojson not found'));

// draw control
const drawnItems = new L.FeatureGroup().addTo(map);
map.addControl(new L.Control.Draw({
  edit: { featureGroup: drawnItems },
  draw: { polygon:true, rectangle:true, polyline:false, circle:false, marker:false, circlemarker:false }
}));

map.on(L.Draw.Event.CREATED, async (e) => {
  drawnItems.clearLayers();
  drawnItems.addLayer(e.layer);
  lastPolygon = e.layer.toGeoJSON();
  e.layer.setStyle({ color:'#d4860a', weight:2.5, opacity:1, fillColor:'#d4860a', fillOpacity:0.08 });
  await refresh();
});

$('clear-draw').addEventListener('click', () => {
  drawnItems.clearLayers();
  lastPolygon = null;
  $('field-pts-badge').style.display = 'none';
  refresh();
});

// ── GEOTIFF LOADING & DISPLAY ────────────────────────────────────
async function loadTiff(indexName) {
  if (tiffCache[indexName]) return tiffCache[indexName];
  try {
    const resp = await fetch(TIFF_PATHS[indexName]);
    if (!resp.ok) throw new Error('not found');
    const buf  = await resp.arrayBuffer();
    const georaster = await parseGeoraster(buf);
    tiffCache[indexName] = georaster;
    return georaster;
  } catch (e) {
    console.warn(`GeoTIFF not found for ${indexName}:`, e.message);
    return null;
  }
}

async function showTiffLayer(indexName) {
  // remove old layer
  if (activeTiffLayer) { map.removeLayer(activeTiffLayer); activeTiffLayer = null; }

  const georaster = await loadTiff(indexName);
  if (!georaster) return;

  const colorFn = INDEX_COLOR_FN[indexName];
  activeTiffLayer = new GeoRasterLayer({
    georaster,
    opacity: 0.75,
    pixelValuesToColorFn: values => {
      const v = values[0];
      if (v === null || v === undefined || isNaN(v)) return null;
      return colorFn(v);
    },
    resolution: 256
  });
  activeTiffLayer.addTo(map);
  activeTiffLayer.bringToBack();

  // update legend
  updateLegend(indexName);
}

function updateLegend(indexName) {
  const el = $('map-legend');
  el.innerHTML = `
    <div class="legend-bar" style="background:${LEGEND_GRADIENTS[indexName]}"></div>
    <span style="font-size:9px;color:var(--text-dim);white-space:nowrap">Low → High</span>
  `;
}

// index button events
document.querySelectorAll('.idx-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    document.querySelectorAll('.idx-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedIdx = btn.dataset.idx;
    await showTiffLayer(selectedIdx);
  });
});

// ── DATE SLIDER ──────────────────────────────────────────────────
function buildSlider() {
  const container = $('slider-dates');
  container.innerHTML = '';
  GRID_DATE_KEYS.forEach(d => {
    const pill = document.createElement('button');
    pill.className = 'date-pill' + (d === selectedDate ? ' active' : '');
    pill.textContent = d;
    pill.addEventListener('click', async () => {
      selectedDate = d;
      document.querySelectorAll('.date-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      $('header-date-display').textContent = d;
      await refresh();
    });
    container.appendChild(pill);
  });
}

// ── CROP SELECTOR ────────────────────────────────────────────────
document.querySelectorAll('.crop-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    selectedCrop = btn.dataset.crop;
    document.querySelectorAll('.crop-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    await refresh();
  });
});

// ── DATA LOADING ─────────────────────────────────────────────────
async function loadLocalData() {
  // master CSV
  try {
    const r = await fetch('data/processed/crop_fitness_master.csv');
    if (!r.ok) throw 0;
    masterData = Papa.parse(await r.text(), { header:true, dynamicTyping:true })
      .data.filter(r => r.date);
  } catch { masterData = FALLBACK_MASTER; }

  // timeseries CSV
  try {
    const r = await fetch('data/gee_exports/crop_fitness_timeseries_macon_2025.csv');
    if (!r.ok) throw 0;
    timeseriesData = Papa.parse(await r.text(), { header:true, dynamicTyping:true })
      .data.filter(r => r.date);
  } catch { timeseriesData = FALLBACK_TIMESERIES; }

  // soil moisture CSV
  try {
    const r = await fetch('data/raw/soil_moisture.csv');
    if (!r.ok) throw 0;
    const rows = Papa.parse(await r.text(), { header:true, dynamicTyping:true })
      .data.filter(r => r.date);
    rows.forEach(r => {
      const d = normaliseDate(r.date);
      if (d) soilData[d] = r.sm_20cm_m3 ?? null;
    });
  } catch { soilData = { ...FALLBACK_SOIL }; }
}

async function loadAllGrids() {
  for (const [date, path] of Object.entries(GRID_PATHS)) {
    try {
      const r = await fetch(path);
      if (!r.ok) throw 0;
      gridCache[date] = await r.json();
    } catch { /* skip — fallback to timeseries */ }
  }
}

// ── POINT-IN-POLYGON ─────────────────────────────────────────────
function avgIndicesForPolygon(polygon, date) {
  const grid = gridCache[date];
  if (!grid || !polygon) return null;
  const inside = (grid.features || []).filter(f => turf.booleanPointInPolygon(f, polygon));
  if (!inside.length) return null;

  const sum = { NDVI:0, NDMI:0, EVI:0, NDRE:0, n:0 };
  inside.forEach(f => {
    const p = f.properties || {};
    sum.NDVI += p.NDVI ?? p.NDVI_mean ?? 0;
    sum.NDMI += p.NDMI ?? p.NDMI_mean ?? 0;
    sum.EVI  += p.EVI  ?? p.EVI_mean  ?? 0;
    sum.NDRE += p.NDRE ?? p.NDRE_mean ?? 0;
    sum.n++;
  });
  const n = sum.n;

  const badge = $('field-pts-badge');
  badge.textContent = `${n} field point${n !== 1 ? 's' : ''}`;
  badge.style.display = 'inline-block';

  return {
    ndvi: +(sum.NDVI/n).toFixed(3),
    ndmi: +(sum.NDMI/n).toFixed(3),
    evi:  +(sum.EVI /n).toFixed(3),
    ndre: +(sum.NDRE/n).toFixed(3)
  };
}

function countyMeanForDate(date) {
  const row = (timeseriesData || FALLBACK_TIMESERIES).find(r => normaliseDate(r.date) === date);
  if (!row) return {};
  return {
    ndvi: row.NDVI_mean ?? null,
    ndmi: row.NDMI_mean ?? null,
    evi:  row.EVI_mean  ?? null,
    ndre: row.NDRE_mean ?? null
  };
}

function masterRowForDate(date) {
  const data = masterData || FALLBACK_MASTER;
  let row = data.find(r => normaliseDate(r.date) === date);
  if (!row) {
    const target = new Date(date).getTime();
    row = data.reduce((best, r) => {
      const d  = Math.abs(new Date(normaliseDate(r.date)).getTime() - target);
      const bd = Math.abs(new Date(normaliseDate(best.date)).getTime() - target);
      return d < bd ? r : best;
    });
  }
  return row;
}

// ── GAUGE ─────────────────────────────────────────────────────────
function setGauge(score, stress) {
  const arc    = $('gauge-arc');
  const numEl  = $('gauge-number');
  const badge  = $('stress-badge');

  if (score === null) {
    arc.style.strokeDashoffset = '251';
    arc.style.stroke = '#ede8dc';
    numEl.textContent = '--';
    numEl.style.fill = '#a0926e';
    badge.textContent = 'Season Complete';
    badge.style.background = '#f7f4ee';
    badge.style.borderColor = '#ddd5c0';
    badge.style.color = '#a0926e';
    return;
  }
  arc.style.strokeDashoffset = String(251 - (score / 100) * 251);
  arc.style.stroke  = stress.color;
  numEl.textContent = score;
  numEl.style.fill  = stress.color;
  badge.textContent = `${stress.emoji} ${stress.label}`;
  badge.style.background   = stress.bg;
  badge.style.borderColor  = stress.border;
  badge.style.color        = stress.color;
}

// ── ECG SPARKLINES ────────────────────────────────────────────────
function drawECG(canvas, value, color, lo, hi, invert=false) {
  if (!canvas) return;
  const W = canvas.offsetWidth || 110;
  const H = 26;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  let norm = 0.4;
  if (value !== null && !isNaN(value)) {
    norm = Math.max(0.05, Math.min(0.95, (value - lo) / (hi - lo)));
    if (invert) norm = 1 - norm;
  }

  const baseline  = H * 0.72;
  const amplitude = H * 0.6 * norm;
  const cx = W * 0.5;

  ctx.strokeStyle = color;
  ctx.lineWidth   = 1.6;
  ctx.shadowColor = color;
  ctx.shadowBlur  = 3;
  ctx.beginPath();
  const pts = [
    [0,       baseline],
    [cx*0.3,  baseline],
    [cx*0.45, baseline + 3],
    [cx*0.55, baseline - amplitude],
    [cx*0.65, baseline + amplitude * 0.25],
    [cx*0.78, baseline],
    [W,       baseline]
  ];
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();

  // baseline guide
  ctx.shadowBlur  = 0;
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth   = 0.5;
  ctx.beginPath();
  ctx.moveTo(0, baseline); ctx.lineTo(W, baseline);
  ctx.stroke();
}

// ── VITALS PANEL ──────────────────────────────────────────────────
function renderVitals(signals, masterRow, complete) {
  const el = $('vitals');
  el.innerHTML = '';

  const soil = soilData[selectedDate] ?? null;
  const cwr  = masterRow?.[CWR_COL[selectedCrop]] ?? null;
  const temp = masterRow?.temp_max_C ?? null;

  const items = [
    { name:'NDVI',     val:signals?.ndvi, unit:'',       lo:0.4,  hi:0.6,  inv:false },
    { name:'NDMI',     val:signals?.ndmi, unit:'',       lo:0.2,  hi:0.4,  inv:false },
    { name:'EVI',      val:signals?.evi,  unit:'',       lo:0.15, hi:0.40, inv:false },
    { name:'NDRE',     val:signals?.ndre, unit:'',       lo:0.2,  hi:0.3,  inv:false },
    { name:'Soil SM',  val:soil,          unit:'m³/m³',  lo:0.15, hi:0.25, inv:false },
    { name:'CWR',      val:cwr,           unit:'mm/d',   lo:5,    hi:7,    inv:true  },
    { name:'Temp Max', val:temp,          unit:'°C',     lo:33,   hi:38,   inv:true  }
  ];

  items.forEach(it => {
    const color = complete ? '#a0926e' : colorForVal(it.val, it.lo, it.hi, it.inv);
    const row = document.createElement('div');
    row.className = 'vital-row' + (complete ? ' season-complete' : '');
    row.style.borderLeftColor = color;

    const nameEl = document.createElement('div');
    nameEl.className = 'vital-name';
    nameEl.textContent = it.name;

    const ecg = document.createElement('canvas');
    ecg.className = 'vital-ecg';

    const valWrap = document.createElement('div');
    valWrap.className = 'vital-val-wrap';

    const valEl = document.createElement('div');
    valEl.className = 'vital-value';
    valEl.style.color = color;
    valEl.textContent = complete
      ? '—'
      : (it.val === null || it.val === undefined ? '--'
          : (typeof it.val === 'number' ? it.val.toFixed(3) : it.val));

    const unitEl = document.createElement('div');
    unitEl.className = 'vital-unit';
    unitEl.textContent = it.unit;

    valWrap.appendChild(valEl);
    valWrap.appendChild(unitEl);
    row.appendChild(nameEl);
    row.appendChild(ecg);
    row.appendChild(valWrap);
    el.appendChild(row);

    requestAnimationFrame(() => drawECG(ecg, complete ? null : it.val, color, it.lo, it.hi, it.inv));
  });
}

// ── CHARTS ────────────────────────────────────────────────────────
const CHART_BASE = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 500 },
  plugins: { legend:{ display:false } },
  scales: {
    x: { ticks:{ color:'#a0926e', font:{ family:'DM Mono', size:8 }, maxTicksLimit:5 },
         grid:{ color:'rgba(0,0,0,0.04)' } },
    y: { ticks:{ color:'#a0926e', font:{ family:'DM Mono', size:8 }, maxTicksLimit:4 },
         grid:{ color:'rgba(0,0,0,0.05)' } }
  }
};

function buildCharts() {
  Object.values(charts).forEach(c => c.destroy());
  charts = {};

  const ts     = timeseriesData || FALLBACK_TIMESERIES;
  const dates  = ts.map(r => normaliseDate(r.date));
  const ndvi   = ts.map(r => r.NDVI_mean ?? null);
  const ndmi   = ts.map(r => r.NDMI_mean ?? null);

  const mRows  = (masterData || FALLBACK_MASTER)
    .filter(r => GRID_DATE_KEYS.includes(normaliseDate(r.date)));
  const mDates = mRows.map(r => normaliseDate(r.date));
  const cwr    = mRows.map(r => r[CWR_COL[selectedCrop]] ?? null);
  const precip = mRows.map(r => r.precip_mm ?? null);

  charts.ndvi = new Chart($('ndvi-chart').getContext('2d'), {
    type:'line',
    data:{ labels:dates, datasets:[{
      data:ndvi, borderColor:'#2d6a2d', backgroundColor:'rgba(45,106,45,0.08)',
      fill:true, tension:0.4, pointRadius:3, pointBackgroundColor:'#2d6a2d'
    }]},
    options:{ ...CHART_BASE, scales:{ ...CHART_BASE.scales, y:{ ...CHART_BASE.scales.y, min:0, max:1 }}}
  });

  charts.ndmi = new Chart($('ndmi-chart').getContext('2d'), {
    type:'line',
    data:{ labels:dates, datasets:[{
      data:ndmi, borderColor:'#2563a8', backgroundColor:'rgba(37,99,168,0.08)',
      fill:true, tension:0.4, pointRadius:3, pointBackgroundColor:'#2563a8'
    }]},
    options:{ ...CHART_BASE, scales:{ ...CHART_BASE.scales, y:{ ...CHART_BASE.scales.y, min:0, max:1 }}}
  });

  charts.cwr = new Chart($('cwr-chart').getContext('2d'), {
    type:'bar',
    data:{ labels:mDates, datasets:[{
      data:cwr, borderRadius:3,
      backgroundColor: cwr.map(v => v === null ? '#ddd5c0' : v > 7 ? '#fdecea' : v > 5 ? '#fef3e0' : '#e8f5e8'),
      borderColor:     cwr.map(v => v === null ? '#c0b090' : v > 7 ? '#c0392b' : v > 5 ? '#d4860a' : '#2d6a2d'),
      borderWidth: 1.5
    }]},
    options: CHART_BASE
  });

  charts.precip = new Chart($('precip-chart').getContext('2d'), {
    type:'bar',
    data:{ labels:mDates, datasets:[{
      data:precip, backgroundColor:'rgba(37,99,168,0.4)',
      borderColor:'#2563a8', borderWidth:1, borderRadius:3
    }]},
    options: CHART_BASE
  });
}

function updateCWRChart() {
  if (!charts.cwr) return;
  const mRows = (masterData || FALLBACK_MASTER)
    .filter(r => GRID_DATE_KEYS.includes(normaliseDate(r.date)));
  const cwr = mRows.map(r => r[CWR_COL[selectedCrop]] ?? null);
  charts.cwr.data.datasets[0].data = cwr;
  charts.cwr.data.datasets[0].backgroundColor = cwr.map(v =>
    v === null ? '#ddd5c0' : v > 7 ? '#fdecea' : v > 5 ? '#fef3e0' : '#e8f5e8'
  );
  charts.cwr.data.datasets[0].borderColor = cwr.map(v =>
    v === null ? '#c0b090' : v > 7 ? '#c0392b' : v > 5 ? '#d4860a' : '#2d6a2d'
  );
  charts.cwr.update();
}

// ── TIMELINE ──────────────────────────────────────────────────────
function renderTimeline() {
  const el = $('timeline-render');
  el.innerHTML = '';

  ['cotton','corn','soybean'].forEach(crop => {
    const complete = isSeasonComplete(crop, selectedDate);
    const row = document.createElement('div');
    row.className = 'timeline-crop-row';

    const label = document.createElement('div');
    label.className = 'timeline-crop-label';
    label.textContent = crop.charAt(0).toUpperCase() + crop.slice(1);

    const stages = document.createElement('div');
    stages.className = 'timeline-stages';

    CROP_STAGES[crop].forEach(s => {
      const pill = document.createElement('div');
      pill.className = 'timeline-stage';
      pill.style.background = s.bg;
      pill.style.color = s.color;
      pill.style.borderColor = s.color + '33';
      pill.style.border = `1px solid ${s.color}33`;
      pill.textContent = s.stage.replace('Yield Formation','Yield Form.');

      const inRange = selectedDate >= s.start && selectedDate <= s.end;
      if (inRange) pill.classList.add('active-stage');
      if (complete) pill.style.opacity = '0.3';
      stages.appendChild(pill);
    });

    if (complete) {
      const done = document.createElement('div');
      done.className = 'timeline-harvested';
      done.textContent = '✓ Harvested';
      stages.appendChild(done);
    }

    row.appendChild(label);
    row.appendChild(stages);
    el.appendChild(row);
  });

  const today = document.createElement('div');
  today.className = 'timeline-today';
  today.textContent = `▶ Viewing: ${selectedDate}`;
  el.appendChild(today);
}

// ── AI NOTE ───────────────────────────────────────────────────────
function buildNote(signals, masterRow, score, stress, complete) {
  if (complete) {
    return [
      `${selectedCrop.toUpperCase()} — Season Complete`,
      ``,
      `This crop has been harvested. No active irrigation decisions needed.`,
      `Review field residue condition and begin planning cover crop or`,
      `next season inputs based on observed soil moisture levels.`
    ].join('\n');
  }
  if (score === null) return 'Insufficient satellite data for this date.';

  const stage = masterRow?.[STAGE_COL[selectedCrop]] ?? 'Unknown';
  const cwr   = masterRow?.[CWR_COL[selectedCrop]]?.toFixed(1) ?? '--';
  const soil  = soilData[selectedDate]?.toFixed(3) ?? '--';
  const temp  = masterRow?.temp_max_C ?? '--';

  let rec = '';
  if (score < 40)      rec = `⚠ IRRIGATE WITHIN 24 HOURS. Severe moisture stress detected during ${stage}. Delayed action risks irreversible yield loss at this growth stage.`;
  else if (score < 70) rec = `Monitor closely. Moderate stress detected in ${stage}. Consider irrigation within 48–72 hours if soil moisture continues to decline below 0.15 m³/m³.`;
  else                 rec = `Crop condition is healthy. Continue current management. Re-assess in 5–7 days or after any extended dry period.`;

  return [
    `${selectedCrop.charAt(0).toUpperCase()+selectedCrop.slice(1)} · ${stage} · ${selectedDate}`,
    `Fitness Score: ${score}/100 — ${stress.label}`,
    `NDVI: ${signals?.ndvi??'--'} · NDMI: ${signals?.ndmi??'--'} · EVI: ${signals?.evi??'--'} · NDRE: ${signals?.ndre??'--'}`,
    `Soil: ${soil} m³/m³ · CWR: ${cwr} mm/day · T-max: ${temp}°C`,
    ``,
    rec
  ].join('\n');
}

$('ai-refresh').addEventListener('click', () => refresh());

// ── MAIN REFRESH ──────────────────────────────────────────────────
async function refresh() {
  const complete  = isSeasonComplete(selectedCrop, selectedDate);
  const masterRow = masterRowForDate(selectedDate);

  let signals = null;
  if (lastPolygon) {
    signals = avgIndicesForPolygon(lastPolygon, selectedDate);
  }
  if (!signals) {
    $('field-pts-badge').style.display = 'none';
    signals = countyMeanForDate(selectedDate);
  }

  const score  = complete ? null : computeFitnessScore(signals);
  const stress = stressFromScore(score);

  setGauge(score, stress);
  renderVitals(signals, masterRow, complete);
  renderTimeline();
  updateCWRChart();
  $('ai-note').textContent = buildNote(signals, masterRow, score, stress, complete);
}

// ── INIT ──────────────────────────────────────────────────────────
(async function init() {
  buildSlider();
  await loadLocalData();
  await loadAllGrids();
  buildCharts();

  // load default NDVI tiff
  await showTiffLayer('NDVI');

  await refresh();

  // hide loading
  const overlay = $('loading-overlay');
  overlay.style.opacity = '0';
  setTimeout(() => overlay.remove(), 400);
})();
