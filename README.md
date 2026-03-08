# 🌾 Crop Vitals — A Decision Support Tool
### Study Area: Macon County, Alabama · 2025 Growing Season

Crop Vitals is an interactive field health monitoring dashboard that helps farmers and extension agents detect crop stress **before visible symptoms appear**. By fusing satellite remote sensing, in-situ soil moisture, and weather data into a single Crop Fitness Score, the system supports earlier, more confident decisions.



## 🚜 Problem

Challenge 1: Integrated operational dashboard with decision-ready alerts
Prompt: How can we integrate multiple data sources into a dashboard that prioritizes attention 
and supports daily decisions?

Modern agricultural data exists in silos. Satellite imagery, weather forecasts, soil sensors, and crop models are each powerful on their own — but farmers and extension agents have no single place to see them together, interpret them jointly, and act on them confidently

## 🌱 Solution

Crop Vitals monitors crop health using **seven vital signs** updated across cloud-free Sentinel-2 acquisition dates:

| Signal | Source | Role |
|---|---|---|
| NDVI | Sentinel-2 via GEE | Canopy greenness / photosynthetic activity |
| NDMI | Sentinel-2 via GEE | Canopy water content |
| EVI | Sentinel-2 via GEE | Dense canopy health |
| NDRE | Sentinel-2 via GEE | Chlorophyll / nitrogen status |
| Soil Moisture | USDA SCAN #2115 Tuskegee AL | Root zone water availability |
| Crop Water Requirement | FAO-56 Penman-Monteith | Daily water demand (ET₀ × Kc) |
| Temperature | NASA POWER | Heat stress indicator |

These signals are combined into a **Crop Fitness Score (0–100)** using agronomic thresholds from ANR-3180 (Auburn Cooperative Extension) and FAO-56 rules.
Crops covered include Cotton, Corn and Soybean


## 🛠️ Technologies

| Layer | Tools |
|---|---|
| Satellite data | Google Earth Engine (Sentinel-2 SR Harmonized) |
| Weather data | NASA POWER API |
| Soil moisture | USDA SCAN Station #2115, Tuskegee AL |
| ET₀ / CWR | FAO-56 Penman-Monteith (Python) |
| Frontend | HTML · CSS · JavaScript |
| Mapping | Leaflet.js · Leaflet.draw · Turf.js |
| Charts | Chart.js |
| Data parsing | PapaParse |
| AI assessment | CropWizard API (UIUC) |
| Version control | GitHub |



## 📊 Scoring Engine

```
Step 1 — ANR-3180 satellite index thresholds (raw values, no normalization)
  NDVI: stressed < 0.4 · healthy ≥ 0.6
  NDMI: stressed < 0.2 · healthy ≥ 0.4
  EVI:  stressed < 0.15 · healthy ≥ 0.40
  NDRE: stressed < 0.2 · healthy ≥ 0.3

Step 2 — FAO-56  (loam soil, Macon County)
  SM < 0.14 m³/m³ → below permanent wilting point → cap score at 35
  SM < 0.18 m³/m³ → below readily available water → subtract 20

Step 3 — Heat stress penalty 
  Temp > 38°C → subtract 15
  Temp > 35°C → subtract 8

Final Score:  0–39 = 🔴 High Stress · 40–69 = 🟡 Moderate · 70–100 = 🟢 Healthy
```



## 🗂️ Data Sources

| Source | Variable | Coverage |
|---|---|---|
| Sentinel-2 SR Harmonized (GEE) | NDVI, NDMI, EVI, NDRE | Macon County · 7 dates · Apr–Jul 2025 |
| NASA POWER API | T2M, RH2M, WS2M, Radiation, Precip | Daily · Apr –Jul 30, 2025 |
| USDA SCAN #2115 Tuskegee AL | Soil moisture at 20cm depth | Daily · Apr –Jul 30, 2025 |
| FAO-56 (calculated) | ET₀, CWR per crop | Daily derived |
| USDA TIGER / GEE Asset | Macon County boundary | Static |



## 🌍 Dashboard Features

- **Date slider** — step through 7 Sentinel-2 acquisition dates to track seasonal progression
- **Crop selector** — Cotton · Corn · Soybean with crop-specific stage calendars and Kc values
- **Spatial dot layer** — ~900 sampled grid points colored by selected index (NDVI / NDMI / EVI / NDRE)
- **Field polygon tool** — draw a boundary on the map to calculate field-specific fitness score via point-in-polygon
- **ECG vital signs** — seven signal indicators with color-coded stress status
- **AI field assessment** — CropWizard (UIUC) generates agronomic recommendations from Extension knowledge base
- **Download button** — export field assessment as `.txt` file
- **Season Complete logic** — an out-of-season crop can automatically transition to the harvested state 

## 🚀 Future Work

- Continuous raster rendering (full 10m Sentinel-2 GeoTIFF) replacing sampled dot layer
- Automated daily GEE export pipeline for real-time updates
- Integration of additional SCAN stations for spatial soil moisture variability
- SSURGO/SoilGrids automated soil parameter retrieval
- Mobile-responsive layout for field use on tablets



## 📚 References

- Pereira, L.S., Allen, R.G., Paredes, P., López-Urrea, R., Raes, D., Smith, M., Kilic, A. & Salman, M. 2025. Crop evapotranspiration – Guidelines for computing crop water requirements. Second edition, revised 2025. FAO Irrigation and Drainage Paper Revised December 2025, No.56 Rev.1. Rome, FAO. https://doi.org/10.4060/cd6621en
- Nguyen, A., Sharma, A., & Prasad, R. (2025). Understanding Vegetation Indices Used in Precision Agriculture (ANR-3180). Alabama Cooperative Extension System, Auburn University.
- NASA POWER Project. https://power.larc.nasa.gov
- USDA NRCS SCAN. Station #2115, Tuskegee AL. [https://wcc.sc.egov.usda.gov/nwcc/site?sitenum=2115&fbclid=IwY2xjawJg4RhleHRuA2FlbQIxMAABHmjFzBDmsn7m8owFmVnTy7jtFJJv5ZBNVCLz_VfrcUr4z0m4cxGcCR6gQpEe_aem_W7hTM0AWcz6yDfr1L_39Kw]
- Google Earth Engine. (n.d.). Earth Engine Data Catalog. https://developers.google.com/earth-engine/datasets (accessed on 7th March 2026).
- ESA Sentinel-2 Mission. Copernicus Open Access Hub.

---

*2026 CDA Hackathon · Team Golden Tigers · Tuskegee University*
