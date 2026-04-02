# QRoots

**Know where you're planting roots.**

QRoots is a neighborhood decision-support tool that combines housing stability risk, quality-of-life indicators, and explainable machine learning into a tract-level score for communities across the United States. It is designed to support people researching where to live, as well as housing intervention efforts by organizers, advocates, service providers, and public-interest teams that need a clearer view of neighborhood-level vulnerability and opportunity.

## Features

- ZIP code and census tract search
- QRoots composite score on a 0-100 scale
- Five dimension scores: Housing Stability, Walkability, Transit, Education, Affordability
- Interactive choropleth map for ZIP-level tract results
- SHAP explainability showing the top 3 driving factors behind each prediction

## Data Sources

- **Census ACS 5-Year Estimates (2022)**  
  Tract-level demographic, income, rent burden, renter occupancy, housing unit, unemployment proxy, and rent data.

- **Princeton Eviction Lab**  
  Tract-level eviction filings, eviction rates, renter-occupied housing, and poverty measures used to derive housing stability labels.

- **CDC PLACES (2025 release)**  
  Census tract health outcome measures including depression and related health burden indicators.

- **HUD Fair Market Rent / USPS Crosswalk**  
  County-level rent benchmarks and ZIP-to-tract relationships used for affordability context and geographic lookup workflows.

- **DSC540 Quality of Life Dataset / Walk Score-derived county metrics**  
  County-level walkability, transit, bike, education, affordability, and composite quality-of-life inputs used in the QRoots score.

## Tech Stack

- **Back end:** Python and FastAPI
- **Modeling:** XGBoost binary classification with SHAP explainability
- **Front end:** React, Tailwind CSS, and React Leaflet / Leaflet
- **Deployment:** Render

## How It Works

1. Raw public datasets are pulled and cleaned into tract-level and county-level processed tables.
2. A tract-level master dataset is built by combining ACS, Eviction Lab, and CDC PLACES data.
3. A binary `high_eviction_risk` target is created using state-relative eviction filing thresholds.
4. An XGBoost model is trained to predict housing stability risk using socioeconomic, rent, and health indicators.
5. SHAP values are generated to explain the top drivers behind each tract prediction.
6. A QRoots composite score is calculated by blending housing stability with neighborhood quality-of-life measures.
7. The FastAPI service loads tract scores, SHAP explanations, and ZIP-to-tract crosswalks into memory for fast lookup.
8. The React front end lets users search by tract or ZIP code, view results, inspect tract boundaries on a map, and understand the factors driving each score.

## QRoots Score Methodology

The QRoots score is calculated on a 0-100 scale using the following weighted components:

- **Housing Stability:** 40%
- **Walkability:** 20%
- **Transit:** 15%
- **Education:** 15%
- **Affordability:** 10%

Housing Stability is derived from the model’s predicted housing risk, inverted so that lower predicted risk yields a higher component score. Affordability is also inverted so that lower rent burden and lower relative housing cost produce higher scores.

## Live Demo

[https://rootscore.onrender.com](https://rootscore.onrender.com)

## Codex Build Process

This project was built with OpenAI Codex as an end-to-end coding partner for data processing, modeling, explainability, API development, and front-end implementation. The prompt and build workflow can be reviewed in [docs/codex-prompts.md](docs/codex-prompts.md).

## Ethics

QRoots is designed to help people make informed decisions about where to live and to support housing intervention efforts. Scores are advisory and reflect neighborhood-level patterns, not individual circumstances. The tool should not be used for tenant screening, exclusionary decision-making, surveillance, or any purpose that treats neighborhood-level signals as judgments about individual households.
