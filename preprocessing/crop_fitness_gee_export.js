/**
 * CROP FITNESS TRACKER — GEE Export Script
 * County    : Macon, Alabama
 * Season    : 2025-04-12 → 2025-07-30
 * Masking   : QA60 only (cloud + cirrus)
 *
 * Exports:
 *   1. crop_fitness_timeseries_macon_2025.csv
 *      → mean indices per clean date (coverage >= 70%)
 *      → powers trend charts
 *
 *   2. crop_fitness_grid_macon_latest_2025.geojson
 *      → 900 points across Macon County from Jul 27 mosaic
 *      → powers field polygon calculations
 *
 *   3. macon_ndvi_20250727.tif
 *   4. macon_ndmi_20250727.tif
 *   5. macon_evi_20250727.tif
 *   6. macon_ndre_20250727.tif
 *      → colored raster images for the switchable map layer
 *      → displayed directly in Leaflet as visual index layers
 */

/* ── SETTINGS ─────────────────────────────────────────────── */
var counties  = ee.FeatureCollection('projects/eeolakanmi-moisture/assets/counties_WGS84');
var maconAOI  = counties.filter(ee.Filter.eq('COUNTY', 'Macon'));
var maconGeom = maconAOI.geometry();

var startDate    = ee.Date('2025-04-12');
var endDate      = ee.Date('2025-07-30');       // extended to Jul 30
var endExclusive = endDate.advance(1, 'day');

var CRS_OUT         = 'EPSG:32616';
var SCALE           = 20;    // 20m — matches B5 and B11 native resolution
var CLOUD_SCENE_MAX = 20;    // scene-level pre-filter
var MOSAIC_WINDOW   = 3;     // days — covers both MGRS tiles over Macon
var COVERAGE_MIN    = 70;    // % — rows below this dropped from export

// July 27 — 98% coverage, best late-season image
// Used for index images and spatial grid
var IMAGE_DATE     = '2025-07-27';
var imageWinStart  = ee.Date(IMAGE_DATE);
var imageWinEnd    = imageWinStart.advance(MOSAIC_WINDOW, 'day');

/* ── 1. LOAD COLLECTION ───────────────────────────────────── */
var S2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterDate(startDate, endExclusive)
  .filterBounds(maconGeom)
  .filter(ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE', CLOUD_SCENE_MAX));

print('Total scenes:', S2.size());
print('MGRS tiles:', S2.aggregate_array('MGRS_TILE').distinct());

/* ── 2. CLOUD MASK (QA60 ONLY) ────────────────────────────── */
function maskClouds(img) {
  var qa   = img.select('QA60');
  var mask = qa.bitwiseAnd(1 << 10).eq(0)
               .and(qa.bitwiseAnd(1 << 11).eq(0));
  return img.updateMask(mask);
}

/* ── 3. SCALE BANDS ───────────────────────────────────────── */
function scaleBands(img) {
  return img.select(['B2','B4','B5','B8','B11'])
            .multiply(0.0001)
            .set('system:time_start',       img.get('system:time_start'))
            .set('CLOUDY_PIXEL_PERCENTAGE', img.get('CLOUDY_PIXEL_PERCENTAGE'));
}

/* ── 4. COMPUTE INDICES ───────────────────────────────────── */
function addIndices(img) {
  var ndvi = img.normalizedDifference(['B8','B4'])
               .rename('NDVI');

  var ndmi = img.normalizedDifference(['B8','B11'])
               .rename('NDMI');

  var ndre = img.normalizedDifference(['B8','B5'])
               .rename('NDRE');

  // EVI clamped to -1/+1 — prevents exploded values from bad pixels
  var evi = img.expression(
    '2.5 * ((NIR - RED) / (NIR + 6.0 * RED - 7.5 * BLUE + 1.0))',
    { NIR: img.select('B8'), RED: img.select('B4'), BLUE: img.select('B2') }
  ).rename('EVI')
   .clamp(-1, 1);

  return ee.Image([ndvi, ndmi, ndre, evi])
    .set('system:time_start',       img.get('system:time_start'))
    .set('CLOUDY_PIXEL_PERCENTAGE', img.get('CLOUDY_PIXEL_PERCENTAGE'));
}

/* ── 5. APPLY PIPELINE ────────────────────────────────────── */
var S2indices = S2.map(function(img) {
  return addIndices(scaleBands(maskClouds(img)));
});

/* ── 6. DISTINCT DATES ────────────────────────────────────── */
function distinctDates(ic) {
  return ee.List(
    ic.aggregate_array('system:time_start')
      .map(function(t) { return ee.Date(t).format('YYYY-MM-dd'); })
  ).distinct().sort();
}

var dates = distinctDates(S2);
print('Acquisition dates:', dates);

/* ── 7. COVERAGE HELPER ───────────────────────────────────── */
var totalPx = ee.Image.constant(1)
  .clip(maconGeom)
  .reduceRegion({
    reducer  : ee.Reducer.count(),
    geometry : maconGeom,
    scale    : SCALE,
    maxPixels: 1e10,
    bestEffort: true
  }).get('constant');

function getCoveragePct(mosaic) {
  var validPx = mosaic.select('NDVI')
    .reduceRegion({
      reducer  : ee.Reducer.count(),
      geometry : maconGeom,
      scale    : SCALE,
      maxPixels: 1e10,
      bestEffort: true
    }).get('NDVI');
  return ee.Number(validPx)
           .divide(ee.Number(totalPx))
           .multiply(100)
           .round();
}

/* ── 8. TIME SERIES CSV ───────────────────────────────────── */
var tsFeatures = dates.map(function(dateStr) {
  dateStr = ee.String(dateStr);

  var winStart = ee.Date.parse('YYYY-MM-dd', dateStr);
  var winEnd   = winStart.advance(MOSAIC_WINDOW, 'day');

  var mosaic = S2indices
    .filterBounds(maconGeom)
    .filterDate(winStart, winEnd)
    .sort('CLOUDY_PIXEL_PERCENTAGE')
    .mosaic()
    .clip(maconGeom);

  var stats = mosaic.reduceRegion({
    reducer  : ee.Reducer.mean(),
    geometry : maconGeom,
    scale    : SCALE,
    maxPixels: 1e10,
    bestEffort: true
  });

  var coverage = getCoveragePct(mosaic);

  var nScenes = S2
    .filterBounds(maconGeom)
    .filterDate(winStart, winEnd)
    .size();

  return ee.Feature(null, {
    county      : 'Macon',
    date        : dateStr,
    NDVI_mean   : stats.get('NDVI'),
    NDMI_mean   : stats.get('NDMI'),
    NDRE_mean   : stats.get('NDRE'),
    EVI_mean    : stats.get('EVI'),
    coverage_pct: coverage,
    n_scenes    : nScenes
  });
});

// Drop low coverage rows before export
var tsClean = ee.FeatureCollection(tsFeatures)
  .filter(ee.Filter.gte('coverage_pct', COVERAGE_MIN));

print('Clean time series rows (coverage >= 70%):', tsClean.size());

Export.table.toDrive({
  collection    : tsClean,
  description   : 'CropFitness_TimeSeries_Macon_2025',
  folder        : 'CropFitness_GEE_Exports',
  fileNamePrefix: 'crop_fitness_timeseries_macon_2025',
  fileFormat    : 'CSV'
});

print('Queued: crop_fitness_timeseries_macon_2025.csv');

/* ── 9. JULY 27 MOSAIC ────────────────────────────────────── */
// 3-day mosaic from Jul 27 — covers both MGRS tiles
// Used for both the spatial grid AND the four index images
// 98% coverage — best late season image available

var jul27mosaic = S2indices
  .filterBounds(maconGeom)
  .filterDate(imageWinStart, imageWinEnd)
  .sort('CLOUDY_PIXEL_PERCENTAGE')
  .mosaic()
  .clip(maconGeom);

print('Jul 27 mosaic coverage (%):', getCoveragePct(jul27mosaic));

/* ── 10. PER-DATE SPATIAL GRID GEOJSON ────────────────────── */
// One GeoJSON per clean acquisition date (coverage >= 70%)
// Each file has ~900 points across Macon County
// Each point stores NDVI, NDMI, EVI, NDRE + lat/lon for that date
//
// Why one per date:
//   When a farmer draws their field polygon the dashboard clips
//   points inside the polygon across ALL date files — giving a
//   field-specific time series, not just a county average.
//   The four GeoTIFF images (Jul 27) handle the visual display.
//   These GeoJSON files handle all the calculations.
//
// Files produced (one per clean date):
//   crop_fitness_grid_macon_20250413.geojson
//   crop_fitness_grid_macon_20250418.geojson
//   crop_fitness_grid_macon_20250505.geojson
//   crop_fitness_grid_macon_20250602.geojson
//   crop_fitness_grid_macon_20250627.geojson
//   crop_fitness_grid_macon_20250712.geojson
//   crop_fitness_grid_macon_20250727.geojson

dates.evaluate(function(dateList) {
  dateList.forEach(function(dateStr) {

    var winStart = ee.Date.parse('YYYY-MM-dd', dateStr);
    var winEnd   = winStart.advance(MOSAIC_WINDOW, 'day');

    // Build mosaic for this date window
    var mosaic = S2indices
      .filterBounds(maconGeom)
      .filterDate(winStart, winEnd)
      .sort('CLOUDY_PIXEL_PERCENTAGE')
      .mosaic()
      .clip(maconGeom);

    // Only export if coverage >= 70% — same threshold as time series CSV
    var coverage = getCoveragePct(mosaic);

    coverage.evaluate(function(covValue) {
      if (covValue < 70) {
        print('Skipping grid for ' + dateStr + ' — coverage ' + covValue + '%');
        return;
      }

      // Sample 900 points across Macon County
      var grid = mosaic
        .select(['NDVI','NDMI','NDRE','EVI'])
        .sample({
          region    : maconGeom,
          scale     : 1000,
          numPixels : 900,
          geometries: true,  // keep lat/lon — required for polygon clipping
          seed      : 42     // same seed = same point locations every date
                             // consistent spatial sampling across all files
        })
        .map(function(f) {
          return f.set({
            county      : 'Macon',
            image_date  : dateStr,
            coverage_pct: covValue
          });
        });

      // Date tag for filename e.g. 20250413
      var dateTag = dateStr.replace(/-/g, '');

      Export.table.toDrive({
        collection    : grid,
        description   : 'CropFitness_Grid_Macon_' + dateTag,
        folder        : 'CropFitness_GEE_Exports',
        fileNamePrefix: 'crop_fitness_grid_macon_' + dateTag,
        fileFormat    : 'GeoJSON'
      });

      print('Queued grid: crop_fitness_grid_macon_' + dateTag + '.geojson  (coverage ' + covValue + '%)');
    });
  });
});

/* ── 11. FOUR INDEX IMAGES ────────────────────────────────── */
// Colored GeoTIFF per index from Jul 27 mosaic
// Displayed directly as Leaflet raster layers in the dashboard
// Farmer toggles between them using the index switcher buttons
// Color scales match the dashboard legend and map check below
//
// Each file is a 3-band RGB image (already colorized by GEE)
// Leaflet reads it as a standard image overlay — no processing needed
// These are the VISUAL layers — calculations still use the GeoJSON

// Color scales — consistent with map check visualization
var visParams = {
  NDVI: { min: 0.1,  max: 0.8,  palette: ['#8B4513','#FFFF00','#006400'] },
  NDMI: { min: -0.1, max: 0.6,  palette: ['#8B2500','#FFFFFF','#00008B'] },
  EVI:  { min: 0.0,  max: 0.7,  palette: ['#F5DEB3','#9ACD32','#228B22'] },
  NDRE: { min: 0.1,  max: 0.55, palette: ['#800080','#FFA500','#00FF00'] }
};

var indexNames = ['NDVI', 'NDMI', 'EVI', 'NDRE'];

indexNames.forEach(function(indexName) {
  var singleBand = jul27mosaic.select(indexName);

  // Colorize using vis params — produces RGB image ready for display
  var colorized = singleBand.visualize(visParams[indexName]);

  Export.image.toDrive({
    image         : colorized,
    description   : 'CropFitness_' + indexName + '_Macon_20250727',
    folder        : 'CropFitness_GEE_Exports',
    fileNamePrefix: 'macon_' + indexName.toLowerCase() + '_20250727',
    region        : maconGeom,
    scale         : 20,             // 20m native resolution
    crs           : CRS_OUT,
    maxPixels     : 1e13,
    fileFormat    : 'GeoTIFF',
    formatOptions : { cloudOptimized: true }  // COG format — faster for web display
  });

  print('Queued image: macon_' + indexName.toLowerCase() + '_20250727.tif');
});

/* ── 12. MAP CHECK ────────────────────────────────────────── */
// Visually confirm Jul 27 mosaic covers full county
// Check for gaps, artifacts, or unexpected values

Map.addLayer(counties,                      {color:'white'},       'Macon boundary');
Map.addLayer(jul27mosaic.select('NDVI'),    visParams['NDVI'],     'NDVI  Jul 27');
Map.addLayer(jul27mosaic.select('NDMI'),    visParams['NDMI'],     'NDMI  Jul 27');
Map.addLayer(jul27mosaic.select('EVI'),     visParams['EVI'],      'EVI   Jul 27');
Map.addLayer(jul27mosaic.select('NDRE'),    visParams['NDRE'],     'NDRE  Jul 27');
Map.centerObject(maconAOI, 10);

/* ── DONE ─────────────────────────────────────────────────── */
print('=== SUMMARY ===');
print('Season        : 2025-04-12 → 2025-07-30');
print('Mosaic window : 3 days');
print('Coverage min  : 70%');
print('');
print('Files in Google Drive → CropFitness_GEE_Exports/');
print('');
print('Time series (county averages):');
print('  crop_fitness_timeseries_macon_2025.csv');
print('');
print('Spatial grids (one per clean date — field calculations):');
print('  crop_fitness_grid_macon_20250413.geojson');
print('  crop_fitness_grid_macon_20250418.geojson');
print('  crop_fitness_grid_macon_20250505.geojson');
print('  crop_fitness_grid_macon_20250602.geojson');
print('  crop_fitness_grid_macon_20250627.geojson');
print('  crop_fitness_grid_macon_20250712.geojson');
print('  crop_fitness_grid_macon_20250727.geojson');
print('');
print('Visual index images (Jul 27 — map display only):');
print('  macon_ndvi_20250727.tif');
print('  macon_ndmi_20250727.tif');
print('  macon_evi_20250727.tif');
print('  macon_ndre_20250727.tif');
print('');
print('Total exports: 12 files');
print('Go to Tasks tab → RUN all exports');
