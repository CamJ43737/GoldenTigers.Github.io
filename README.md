# Crop Vitals - Field Health Monitoring System

 🌱 Overview
Crop Vitals is an interactive agricultural monitoring concept that helps farmers quickly identify plant stress using immersive visualization. 

The system simulates plant‑health metrics such as:
- Soil moisture
- Sunlight exposure
- Nutrient levels
- NDVI / NDVE vegetation indices

These inputs are processed and visualized as stress indicators inside a virtual farm environment.

 🚜 Problem
Farmers often struggle to detect plant stress early, especially in large crop fields. Stress caused by drought, poor soil nutrient availability, and environmental conditions is frequently discovered too late, reducing yield and crop quality. Traditional monitoring is slow, manual, and lacks real‑time insights.

 🌾 Solution
Crop Vitals visualizes plant data in an immersive virtual environment with:
- 3D plant models
- Color‑coded health indicators
- Real-time stress simulation
- Interactive diagnostic pop‑ups
- Optional analytics dashboard

  Color Coding:
- 🟢 Green – Healthy
- 🟡 Yellow – Mild Stress
- 🔴 Red – High Stress

Users can click or tap plants to reveal detailed health metrics.

 🛠️ Technologies Used
  Core System:
- 🧱 CoBlocks VR for immersive environment design
- 🟨 JavaScript for dashboard and simulation logic
- 🎨 HTML/CSS for UI layout and styling
- 🐍 Python for stress‑score simulation
- 🔗 GitHub for version control

Optional Enhancements:
- 📊 Chart.js for visualization
- 📁 JSON datasets for mock plant data

 🔍 How the System Works
Each plant object contains agricultural condition variables:
```json
{
  "plants": [
    {
      "name": "Plant A",
      "soilMoisture": 65,
      "sunlight": 80,
      "nutrients": 70
    },
    {
      "name": "Plant B",
      "soilMoisture": 40,
      "sunlight": 55,
      "nutrients": 50
    }
  ]
}
```
The system computes a stress score based on threshold rules and vegetation index values. The VR environment loads these values dynamically for visualization.

 🚀 Future Improvements
- Integration with drone imaging for real NDVI/thermal data
- IoT sensor network support
- AI‑powered plant disease detection
- Mobile AR crop inspection
- Full farm‑scale health mapping
