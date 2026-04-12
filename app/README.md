# QRoots

**Know where you're planting roots.**

QRoots is a neighborhood quality-of-life and housing stability platform designed for people researching where to live, as well as advocates, service providers, and intervention teams working to support communities facing housing instability. It combines tract-level housing risk signals, quality-of-life indicators, explainable AI, and ZIP-level exploration tools to help users understand not just how a place scores, but why.

## Features

- ZIP code and census tract search
- QRoots composite score on a 0-100 scale
- Five core dimension scores: Housing Stability, Walkability, Transit, Education, Affordability
- Explorer mode with six customizable dimension weight sliders that always sum to 100%
- LGBT Policy score as an optional sixth Explorer dimension sourced from the Movement Advancement Project MAP state policy tally
- Interactive choropleth map for ZIP-level tract exploration
- SHAP explainability showing the top 3 driving factors behind each tract result
- AI neighborhood summary powered by OpenAI `gpt-4o-mini`
- Collapsible resource links on every result card with seven contextual links per neighborhood:
  - housing assistance
  - walkability
  - transit
  - schools
  - affordability
  - mental health
  - LGBT resources
- Shareable URLs — every ZIP and GEOID search updates the browser URL so results can be shared directly with a link
- Copy Link button on every result for one-click sharing

## Data Sources

- **Census ACS 5-Year Estimates**  
  Tract-level demographic, income, rent burden, renter occupancy, housing unit, and unemployment proxy data.

- **Princeton Eviction Lab**  
  Tract-level eviction filings, eviction rates, renter-occupied housing, and poverty indicators used for housing stability modeling.

- **CDC PLACES 2025**  
  Census tract health measures including depression and related quality-of-life indicators.

- **HUD Fair Market Rent / USPS ZIP-to-Tract Crosswalk**  
  Rent benchmarks and ZIP/tract relationships used for affordability scoring and location lookup.

- **Walk Score-derived Quality of Life Dataset**  
  County-level walkability, transit, education, and affordability context used in the QRoots composite score.

- **Movement Advancement Project (MAP)**  
  State-level LGBT policy tally scores normalized into a 0-100 scale and exposed as an optional Explorer dimension.

## Tech Stack

- **Back end:** Python and FastAPI
- **Modeling:** XGBoost with SHAP explainability
- **Front end:** React, Tailwind CSS, React Leaflet, and Leaflet
- **AI summaries:** OpenAI `gpt-4o-mini`
- **Deployment:** Render

## How It Works

1. Public tract-level and county-level datasets are cleaned and merged into a QRoots modeling and scoring pipeline.
2. An XGBoost model estimates tract-level housing stability risk using eviction, rent burden, housing, economic, and health indicators.
3. SHAP explanations identify the top 3 factors driving each tract’s risk prediction.
4. A QRoots composite score is calculated on a 0-100 scale across five core dimensions: Housing Stability, Walkability, Transit, Education, and Affordability.
5. ZIP-level search aggregates tract-level scores, generates a plain-language AI neighborhood summary, and updates the browser URL for easy sharing.
6. The Explore tab lets users rank ZIP codes within a selected state by customizing six dimension weights and minimum thresholds.
7. Result cards provide additional context through expandable neighborhood resource links tailored to each ZIP and state.

## QRoots Score Methodology

The QRoots score is calculated on a 0-100 scale using these core weighted components:

- **Housing Stability:** 40%
- **Walkability:** 20%
- **Transit:** 15%
- **Education:** 15%
- **Affordability:** 10%

Housing Stability is derived from the model’s predicted housing risk and inverted so lower risk yields a higher score. Affordability is also inverted so lower relative rent pressure produces a higher score.

### Explorer-Only Optional Dimension

QRoots Explorer also supports an optional sixth dimension:

- **LGBT Policy:** optional user-defined weight

This score is normalized from Movement Advancement Project MAP state tally scores using min-max normalization across approximate current values ranging from **-18 to +46**, then applied uniformly to ZIPs within each state for Explorer ranking.

## Live Demo

[https://qroots.onrender.com](https://qroots.onrender.com)

## GitHub

[https://github.com/timothytroyhollis-ctrl/QRoots](https://github.com/timothytroyhollis-ctrl/QRoots)

## Ethics

QRoots is designed to help people make informed decisions about where to live and to support housing intervention efforts. Scores are advisory and reflect neighborhood-level patterns, not individual circumstances. The tool should not be used for tenant screening, exclusionary decision-making, surveillance, or any purpose that treats neighborhood-level signals as judgments about individuals.
