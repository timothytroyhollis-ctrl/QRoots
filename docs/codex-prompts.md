# QRoots — Codex Prompt Log
**Project:** QRoots — Neighborhood Quality of Life Tool 
**Contest:** OpenAI Codex Contest 2026  
**Author:** Tim Hollis
**Submission Deadline:** April 30, 2026

---

## Prompt 001 — Workspace Inspection and Project Initialization
**Date:** 2026-03-26  
**Purpose:** Determine whether the Codex sandbox contains existing project files, configuration files, or Python patterns to follow before generating new scripts.

**Prompt:**  
I'm going to inspect the workspace for census_config.json and see whether there's an existing Python project or script pattern to follow, then I'll add the ACS pull script and verify the output shape.

**Codex Output Summary:**  
Codex inspected the workspace using PowerShell commands, confirmed the repository was empty, and determined that no existing Python project structure or configuration files were present. It concluded that a self-contained ingestion script would be required and prepared the environment for generating new project files.

**Key Design Decisions:**  
- Self-contained script architecture chosen since no existing project patterns were present  
- census_config.json established as the API key storage pattern for all future ingestion scripts  
- Codex confirmed environment readiness before any code generation began

**Next:** Prompt 002 — ACS Tract-Level Ingestion Script

---

## Prompt 002 — ACS Tract-Level Ingestion Script
**Date:** 2026-03-26  
**Purpose:** Generate a complete ACS ingestion pipeline with county-level batching.

**Prompt:**  
Write a Python script that pulls census tract-level data from the Census ACS 5-Year API (2022) for all tracts in the United States. Fields to retrieve: median household income (B19013_001E), gross rent as a percentage of household income (B25070_010E for 35%+ burden), total renter-occupied units (B25003_003E), total housing units (B25001_001E), unemployment rate proxy (B23025_005E for unemployed, B23025_003E for labor force), and median gross rent (B25064_001E). Use the census_config.json file for the API key. Output a clean pandas DataFrame saved to acs_tract_data.csv with a standardized 11-digit GEOID column.

**Codex Output Summary:**  
Codex generated pull_acs_tract_data.py, including config loading, county-level batching, tract-level ACS pulls, GEOID standardization, derived metrics, and CSV output. The script compiled successfully.

**Key Design Decisions:**  
- County-level batching chosen over state-level to avoid Census API timeouts  
- Exponential backoff with 5 retries added for retry resilience on dropped connections  
- GEOID zero-padded to 11 digits as the universal merge key for all five data sources  
- Two derived features computed at ingestion time: rent_burden_35_plus_share and unemployment_rate_proxy  
- Sentinel values coerced to NaN via pd.to_numeric(errors="coerce") to handle Census API -999999999 patterns

**Next:** Prompt 003 — Eviction Lab Ingestion Script

---

## Prompt 003 — Eviction Lab Ingestion Script
**Date:** 2026-03-26  
**Purpose:** Generate a local CSV ingestion script for Eviction Lab validated tract-level data.

**Prompt:**  
Now write a SEPARATE new Python script called pull_evictionlab_data.py that processes the 
Eviction Lab data. This script should NOT call any API. It only reads a local CSV file from 
data/raw/all-tracts.csv using pandas. Fields to retain: GEOID, year, eviction-filing-rate, 
eviction-rate, eviction-filings, evictions, renter-occupied-homes, poverty-rate. Filter to 
the most recent available year in the dataset. Standardize the GEOID column to 11 digits with 
zero-padding. Replace any -1 values with NaN as these are Eviction Lab sentinel values for 
missing data. Output a clean pandas DataFrame saved to data/processed/evictionlab_tract_data.csv 
and print the row count and year filtered to.

**Codex Output Summary:**  
Codex generated pull_evictionlab_data.py as a fully local script with no API calls. Script 
included sentinel value replacement, dynamic most-recent-year filtering, GEOID zero-padding, 
and automatic creation of the data/processed/ output directory.

**Key Design Decisions:**  
- No API calls — Eviction Lab requires manual download and terms of use agreement  
- Filters dynamically to most recent year rather than hardcoding, future-proofing the script  
- OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True) auto-creates output folder if missing  
- Regex extract on GEOID handles any unexpected formatting in the raw file

**Real-World Discovery:**  
Column names in all-tracts.csv use dot notation (eviction.filing.rate) not dashes as 
documented. Required a manual fix to KEEP_COLUMNS after running and catching the ValueError. 
Most recent validated year in the dataset is 2016 — a known Eviction Lab coverage limitation, 
not a script error. Output: 15,217 tract rows saved to data/processed/evictionlab_tract_data.csv.

**Next:** Prompt 004 — HUD Fair Market Rent Ingestion Script

---

## Prompt 004 — HUD Fair Market Rent Ingestion Script
**Date:** 2026-03-26  
**Purpose:** Generate a HUD Fair Market Rent API ingestion script at the metro area level.

**Prompt:**  
Write a Python script called pull_hud_fmr_data.py that downloads HUD Fair Market Rent data 
for fiscal year 2022. Use the HUD API to fetch FMR data at the county level for all states. 
Fields to retain: fips_code, county_name, state_code, fmr_0br, fmr_1br, fmr_2br, fmr_3br, 
fmr_4br. Standardize the fips_code column to 5 digits with zero-padding. Output a clean 
pandas DataFrame saved to data/processed/hud_fmr_data.csv and print the row count.

**Codex Output Summary:**  
Codex searched the HUD API docs before writing the script, identified the correct Bearer 
token auth pattern, and used the statedata endpoint to fetch metro area FMR records 
state by state. Script compiled successfully but required two fixes before running.

**Key Design Decisions:**  
- Bearer token loaded from hud_config.json, mirroring the census_config.json pattern
- State-by-state fetching chosen to avoid pagination issues on a single large request
- FMR captured across all bedroom sizes (0-4br) for maximum feature flexibility in modeling

**Real-World Discoveries:**  
- HUD API returns a flat list from /listStates, not a nested payload["data"]["states"] 
  structure as Codex assumed. Fixed fetch_states to return payload directly.
- County endpoint returns metroareas not counties, and uses code not fips_code as the 
  identifier. Fixed fetch_state_counties and build_dataframe rename map accordingly.
- HUD FMR data is at metro area level not tract level. Merge strategy: join on first 5 
  digits of tract GEOID to county FIPS during the merge script.
- Output: 4,765 metro area rows saved to data/processed/hud_fmr_data.csv.

**Next:** Prompt 005 — CDC PLACES Ingestion Script

---

## Prompt 005 — CDC PLACES Ingestion Script
**Date:** 2026-03-26  
**Purpose:** Generate a local CSV ingestion script for CDC PLACES census tract health data.

**Prompt:**  
Write a Python script called pull_cdc_places_data.py that processes CDC PLACES census 
tract-level health data. The script should read a local CSV file from data/raw/PLACES__
Local_Data_for_Better_Health,_Census_Tract_Data,_2025_release_20260326.csv using pandas. 
Fields to retain: LocationID, StateAbbr, StateDesc, LocationName, Category, Measure, 
Data_Value, TotalPopulation. Filter rows where Measure is in target measures list. Rename 
LocationID to GEOID and standardize to 11 digits with zero-padding. Pivot the data so each 
measure becomes its own column. Output a clean pandas DataFrame saved to 
data/processed/cdc_places_data.csv and print the row count.

**Codex Output Summary:**  
Codex generated pull_cdc_places_data.py with pivot table logic, GEOID standardization, 
and automatic output directory creation. Script compiled cleanly on first pass.

**Key Design Decisions:**  
- Pivot table approach converts long-format CDC data to one row per tract
- Category filter removed after discovering 2025 release organizes measures differently
- TotalPopulation dropped from pivot index after causing row collapse to only 602 rows
- Final pivot index uses only GEOID and StateAbbr for clean one-row-per-tract output

**Real-World Discoveries:**  
- CDC PLACES 2025 release uses different measure names than documented. Original prompt 
  specified "Mental Health Not Good for >=14 Days" but actual name is "Frequent mental 
  distress among adults". All three measure names required correction.
- TotalPopulation had multiple values per tract causing pivot collapse from 78,815 to 
  602 rows. Fixed by removing TotalPopulation from pivot index.
- Output: 78,815 tract rows saved to data/processed/cdc_places_data.csv with three 
  health indicator columns.

**Next:** Prompt 006 — BLS/FRED Economic Indicators Ingestion Script

  ---

## Prompt 006 — BLS/FRED Economic Indicators Ingestion Script
**Date:** 2026-03-26  
**Purpose:** Generate a FRED API ingestion script for county-level unemployment rates.

**Prompt:**  
Write a Python script called pull_fred_data.py that downloads county-level unemployment 
rate data for all US counties using the FRED API from the St. Louis Fed. Use the fredapi 
Python library. Load the FRED API key from a file called fred_config.json with key name 
api_key. For each county fetch the most recent annual unemployment rate using the series 
ID pattern XXXUR where XXX is the county FIPS code. Collect all counties into a single 
DataFrame with columns: fips_code, county_name, unemployment_rate. Zero-pad fips_code to 
5 digits. Save output to data/processed/fred_data.csv and print the row count.

**Codex Output Summary:**  
Codex searched for FRED series ID patterns before writing, built county list from Census 
API, and implemented defensive error handling for missing series. Script compiled cleanly.

**Key Design Decisions:**  
- One API call per county chosen over bulk download for maximum series coverage
- Defensive try/except returns pd.NA instead of crashing on missing county series
- County list sourced from Census API to stay consistent with ACS pattern
- Progress printing added every 100 counties given 3000+ API calls expected

**Real-World Discoveries:**  
- Python 3.11 does not support float | pd.NA union type hint syntax. Fixed by removing 
  type hints from fetch_latest_unemployment_rate and unemployment_rates list.
- series_id variable was dropped during type hint fix and had to be restored manually.
- fredapi already installed in DSC630 environment from prior coursework.
- Script runs one API call per county — estimated 30-60 minutes for full national pull.

**Next:** Prompt 007 — Master Merge Script

---

## Prompt 007 — Master Merge Script
**Date:** 2026-03-27  
**Purpose:** Generate a script that merges all five processed data sources into a single 
tract-level master dataset for modeling.

**Prompt:**  
Write a Python script called build_master_dataset.py that merges five processed datasets 
into a single tract-level master CSV. Load these files: data/processed/acs_tract_data.csv, 
data/processed/evictionlab_tract_data.csv, data/processed/cdc_places_data.csv, 
data/processed/hud_fmr_data.csv, data/processed/fred_data.csv. The merge key is GEOID for 
tract-level sources. For HUD and FRED which are at county level, join on the first 5 digits 
of GEOID as county_fips. Start with ACS as the base and left join all other sources. After 
merging print row count, column list, and null counts for every column. Save to 
data/processed/master_dataset.csv.

**Codex Output Summary:**  
Codex generated build_master_dataset.py with separate loaders for tract-level and 
county-level sources, derived county_fips from first 5 digits of GEOID, and implemented 
left joins for all five sources against the ACS base.

**Key Design Decisions:**  
- ACS chosen as base for left joins to preserve all 85,396 tracts
- Separate load functions for tract vs county level files
- county_fips derived from first 5 digits of GEOID for HUD and FRED joins
- Null counts printed for all columns to expose join quality before modeling

**Real-World Discoveries:**  
- FRED unemployment series pattern {fips_code}UR (e.g. 01001UR) returned HTTP 400 Bad 
  Request — series does not exist in FRED. Pattern was incorrect.
- ACS already provides unemployment_rate_proxy at tract level which is more granular 
  than county-level FRED data. FRED dropped entirely in favor of ACS unemployment.
- HUD metro area codes (METRO11500M11500) cannot join on 5-digit county FIPS — 82,908 
  of 85,407 rows returned null for all HUD columns. Join strategy fundamentally broken.
- Row count of 85,407 instead of expected 85,396 indicates 11 duplicate tracts.

**Next:** Prompt 008 — Clean Master Merge Script

---

## Prompt 008 — Clean Master Merge Script
**Date:** 2026-03-27  
**Purpose:** Remove broken HUD and FRED sources, deduplicate master dataset.

**Prompt:**  
Update build_master_dataset.py to remove HUD Fair Market Rent as a data source. Delete 
HUD_PATH, hud_df, and the HUD merge step. Also add a deduplication step after all merges 
using drop_duplicates on GEOID keeping the first occurrence. The final sources are ACS, 
Eviction Lab, and CDC PLACES only. Save to data/processed/master_dataset.csv and print 
row count, columns, and null counts.

**Codex Output Summary:**  
Codex edited build_master_dataset.py removing HUD_PATH, hud_df, the HUD merge step, 
and added drop_duplicates on GEOID. Script recompiled cleanly on first pass.

**Key Design Decisions:**  
- HUD dropped due to metro-area join key mismatch with tract-level GEOID
- FRED dropped in Prompt 007 revision — ACS unemployment_rate_proxy is sufficient
- Deduplication on GEOID keeps first occurrence to resolve 11 duplicate tract rows
- Final three sources: ACS (85,396 tracts), Eviction Lab (15,217 tracts), CDC PLACES 
  (78,815 tracts)

 **Real-World Discoveries:**  
- After removing HUD and FRED, row count corrected to exactly 85,396 — 
  confirming the 11 duplicates came from the HUD fan-out join
- Three source merge runs cleanly with no duplicate GEOIDs 

**Next:** Prompt 009 — Feature Engineering and Target Variable Creation

---

## Prompt 009 — Feature Engineering and Target Variable Creation
**Date:** 2026-03-27  
**Purpose:** Transform master dataset into a clean modeling-ready dataset with target 
variable and imputed features.

**Prompt:**  
Write a Python script called build_features.py that prepares the master dataset for 
machine learning. Load data/processed/master_dataset.csv. Create a binary target variable 
called high_eviction_risk: tracts in the top 33rd percentile of eviction.filing.rate 
within their state are labeled 1 (high risk), all others are labeled 0 (low risk). Drop 
rows where eviction.filing.rate is null since these cannot be labeled. Select these feature 
columns for modeling: median_household_income, rent_burden_35_plus_share, 
renter_occupied_units, total_housing_units, unemployment_rate_proxy, median_gross_rent, 
poverty.rate, depression_among_adults, fair_poor_health_status, frequent_mental_distress. 
Impute missing values using median imputation for all feature columns. Save the final 
modeling dataset to data/processed/modeling_dataset.csv with GEOID, all features, and 
the target variable. Print row count, class balance, and null counts after imputation.

**Codex Output Summary:**  
Codex generated build_features.py with defensive column aliasing to handle dot vs 
underscore naming differences across sources, state-relative percentile thresholding, 
median imputation applied after labeling, and clean deduplication on GEOID.

**Key Design Decisions:**  
- State-relative 67th percentile threshold chosen over national threshold so tracts are 
  compared within their own state context — a 40% filing rate means different things in 
  different states
- Median imputation applied after target variable creation so imputed values don't 
  influence the threshold calculation
- Defensive column aliasing handles dot vs underscore naming across all five sources
- Rows with null eviction.filing.rate dropped entirely since they cannot be labeled

**Real-World Discoveries:**  
- Master dataset has 72,595 null eviction filing rates — only 12,694 tracts have 
  validated Eviction Lab data and can be used for model training
- Class balance landed at exactly 67/33 (8,454 low risk / 4,240 high risk) as designed
- Zero nulls after median imputation across all 10 feature columns
- Output: 12,694 rows saved to data/processed/modeling_dataset.csv

**Next:** Prompt 010 — Model Training (Logistic Regression + XGBoost)

---

## Prompt 010 — Model Training (Logistic Regression + XGBoost)
**Date:** 2026-03-27  
**Purpose:** Train and evaluate binary classification models to predict high eviction risk.

**Prompt:**  
Write a Python script called train_model.py that trains a binary classification model on 
data/processed/modeling_dataset.csv to predict high_eviction_risk. Steps: load the dataset, 
split into train/test sets (80/20, random_state=42, stratified on target). Train a logistic 
regression baseline model with class_weight='balanced'. Then train an XGBoost classifier 
with class_weight='balanced' equivalent using scale_pos_weight. Evaluate both models with 
classification_report, F1 score, and AUC-ROC on the test set. Print all metrics clearly. 
Save the best performing model as models/xgboost_model.pkl and the feature column list as 
models/feature_columns.pkl using joblib.

**Codex Output Summary:**  
Codex generated train_model.py with stratified split, dynamic scale_pos_weight calculation, 
side-by-side evaluation of both models, and conditional save of whichever model wins on F1.

**Key Design Decisions:**  
- Stratified split preserves 67/33 class balance in both train and test sets
- scale_pos_weight calculated dynamically from actual class counts not hardcoded
- Best model saved by F1 score not assumed to be XGBoost
- Feature columns saved separately as models/feature_columns.pkl for API use later

**Results:**  
- Logistic Regression: F1 0.5461, AUC-ROC 0.6951
- XGBoost: F1 0.6587, AUC-ROC 0.8103
- XGBoost won and saved to models/xgboost_model.pkl
- AUC-ROC of 0.81 is considered strong for social science prediction problems

**Next:** Prompt 011 — SHAP Explainability Layer

---

## Prompt 011 — SHAP Explainability Layer
**Date:** 2026-03-27  
**Purpose:** Generate per-tract SHAP explanations showing top 3 driving factors 
for every prediction in the modeling dataset.

**Prompt:**  
Write a Python script called explain_model.py that loads models/xgboost_model.pkl 
and models/feature_columns.pkl using joblib, then loads data/processed/modeling_dataset.csv. 
Use the shap library to compute SHAP values for every row in the dataset. For each tract 
output the top 3 features driving the prediction with their SHAP values. Save a DataFrame 
to data/processed/shap_explanations.csv with columns: GEOID, predicted_risk_score, 
top_feature_1, top_feature_1_value, top_feature_2, top_feature_2_value, top_feature_3, 
top_feature_3_value. Print the first 5 rows.

**Codex Output Summary:**  
Codex generated explain_model.py using shap.Explainer with the trained XGBoost model, 
computing per-row SHAP values and extracting top 3 features by absolute SHAP magnitude 
for every tract. Output saved as a flat CSV with one row per tract.

**Key Design Decisions:**  
- Top 3 features ranked by absolute SHAP value so direction doesn't affect ranking
- SHAP value sign preserved in output so negative values show risk-reducing factors
- predicted_risk_score derived from predict_proba not predict for continuous scoring
- Flat CSV format chosen for easy API consumption later

**Results:**  
- 12,694 tract explanations generated successfully
- Each tract has a risk score 0-1 and top 3 named driving factors with direction
- Example: tract 01001020100 risk score 14.6%, driven down by high median gross rent, 
  low renter occupied units, and low depression rates
- Output saved to data/processed/shap_explanations.csv

**Next:** Prompt 012 — FastAPI Back End

---

## Prompt 012 — FastAPI Back End
**Date:** 2026-03-27  
**Purpose:** Build a REST API that serves RootScore predictions and SHAP explanations.

**Prompt:**  
Write a Python FastAPI application called api/main.py that serves RootScore predictions. 
The app should have three endpoints: GET /health that returns status ok, GET /tract/{geoid} 
that accepts an 11-digit census tract GEOID and returns the predicted risk score, risk tier 
(low/medium/high/critical), and top 3 driving factors with plain-language labels, and GET 
/city/{city_name} that returns all tracts for a given state abbreviation and city ranked by 
risk score descending. On startup load data/processed/shap_explanations.csv and 
data/processed/modeling_dataset.csv into memory as pandas DataFrames. Map feature names 
to plain-language labels for the response. Return all responses as JSON. Include CORS 
middleware so a React front end can call it.

**Codex Output Summary:**  
Codex generated api/main.py with startup data loading, CORS middleware, three endpoints, 
risk tier thresholding, plain-language feature label mapping, and graceful error handling 
with proper HTTP status codes throughout.

**Key Design Decisions:**  
- Data loaded into memory on startup so no disk reads on every request
- CORS allow_origins wildcard enables React front end to call from any domain
- Risk tiers calibrated at 0.35/0.65/0.85 thresholds (low/medium/high/critical)
- Plain language labels map technical feature names to counselor-readable descriptions
- City endpoint made defensive since modeling dataset lacks city name column

**Results:**  
- API running at http://localhost:8000
- GET /health returns {"status": "ok"}
- GET /tract/01001020100 returns risk score 0.1446, tier "low", top 3 SHAP factors
- Interactive docs available at http://localhost:8000/docs
- Full production-quality JSON response on first run

**Next:** Prompt 013 — React Front End

---

## Prompt 013 — React Front End
**Date:** 2026-03-27  
**Purpose:** Build a professional React single-page application for RootScore.

**Prompt:**  
Write a React single-page application in app/src/App.jsx that serves as the RootScore 
front end. The app should have a search bar where users can type a census tract GEOID 
or a city name plus state abbreviation. On search it calls the RootScore FastAPI back 
end at http://localhost:8000. Display results as a clean card showing: GEOID, risk score 
as a percentage, risk tier as a colored badge (green=low, yellow=medium, orange=high, 
red=critical), and top 3 driving factors with plain language labels and direction arrows. 
Use Tailwind CSS for styling. Include a header with RootScore name and tagline: Know 
before displacement happens.

**Codex Output Summary:**  
Codex generated App.jsx with branded header, single search bar handling both GEOID and 
city/state formats, color-coded risk tier badges, SHAP direction arrows, and clean result 
cards. Unicode arrow fix applied automatically by Codex after spotting encoding issue.

**Key Design Decisions:**  
- Single search bar parses input automatically as GEOID or City, ST format
- Color coded badges: green=low, amber=medium, orange=high, red=critical
- SHAP direction shown as up/down arrows with red/green coloring
- Plain language factor descriptions replace technical feature names
- Tailwind CSS v3 required over v4 due to create-react-app compatibility

**Real-World Discoveries:**  
- Tailwind v4 installed by default but incompatible with create-react-app. 
  Fixed by explicitly installing tailwindcss@3 postcss autoprefixer.
- App.js and App.jsx conflict — deleted default App.js to load our component.
- City search returns error since modeling dataset lacks city name column. 
  To be fixed in next session.
- Output: RootScore UI live at localhost:3000 with working tract search.

**Next:** Prompt 014 — ZIP Code Search

---

## Prompt 014 — ZIP Code Search (Replacing City Search)
**Date:** 2026-03-28  
**Purpose:** Replace broken city search with ZIP code search using a tract crosswalk.

**Prompt:**  
Update api/main.py to add ZIP code search. On startup also load 
data/processed/zip_tract_crosswalk.csv into memory as a DataFrame with columns zip and 
tract_geoid. Remove the /city/{city_name} endpoint entirely. Add a new endpoint GET 
/zip/{zipcode} that accepts a 5-digit zip code, looks up all matching tract_geoid values 
from the crosswalk, fetches risk scores for each tract from the shap DataFrame, and returns 
them ranked by predicted_risk_score descending. Return the zip code, tract count, and list 
of tracts each with GEOID, predicted_risk_score, risk_tier, and top_driving_factors. 
Return 404 if zip code not found in crosswalk.

**Codex Output Summary:**  
Codex updated api/main.py removing the city endpoint entirely, added ZIP crosswalk loading 
on startup, and implemented GET /zip/{zipcode} with ranked tract results and full driving 
factors per tract. Also cleaned up unused Query import from city endpoint removal.

**Key Design Decisions:**  
- ZIP crosswalk loaded into memory on startup for fast lookups
- City search removed entirely — ZIP is more intuitive for end users and judges
- Crosswalk sourced from Census Bureau ZCTA to tract relationship file (148,897 rows)
- HUD USPS crosswalk API returned 403 Forbidden — Census Bureau file used instead

**Real-World Discoveries:**  
- HUD USPS crosswalk endpoint requires separate API access not included with FMR token
- ZIP search returned 0 results for San Antonio 78201 — root cause: only 12,694 of 
  85,396 tracts have predictions (Eviction Lab coverage limitation)
- Fix: score all 85,396 tracts using the trained model regardless of Eviction Lab 
  coverage — model can predict on any tract using ACS and CDC features alone

**Next:** Prompt 015 — Score All 85,396 Tracts

---

## Prompt 015 — Score All 85,396 Tracts
**Date:** 2026-03-28  
**Purpose:** Generate predictions for all US census tracts so any ZIP code returns results.

**Prompt:**  
Write a Python script called score_all_tracts.py that loads the trained model from 
models/xgboost_model.pkl and feature columns from models/feature_columns.pkl using joblib. 
Load data/processed/master_dataset.csv which has 85,396 tracts. Impute missing values 
using median imputation for all feature columns. Generate predicted_risk_score for all 
85,396 tracts using predict_proba. Then run SHAP explanations for all tracts and extract 
top 3 driving factors per tract. Save the full output to 
data/processed/shap_explanations_all.csv with columns: GEOID, predicted_risk_score, 
top_feature_1, top_feature_1_value, top_feature_2, top_feature_2_value, top_feature_3, 
top_feature_3_value. Print row count when done.

**Codex Output Summary:**  
Codex generated score_all_tracts.py loading the trained XGBoost model and feature columns, 
reading all 85,396 tracts from master_dataset.csv, applying median imputation, scoring with 
predict_proba, computing SHAP values for all rows, and extracting top 3 drivers per tract. 
Script includes defensive column aliasing to handle naming differences across sources.

**Next:** Manual Fix 016 — Update API to Use Full Tract Dataset

---

## Manual Fix 016 — Update API to Use Full Tract Dataset
**Date:** 2026-03-28  
**Purpose:** Point API to shap_explanations_all.csv for full national coverage.

**Change Made:**  
In api/main.py changed SHAP_PATH from:
data/processed/shap_explanations.csv  
to:  
data/processed/shap_explanations_all.csv

**Reason:**  
Single line path change did not warrant a full Codex prompt. score_all_tracts.py 
generated predictions for all 85,396 tracts enabling any US ZIP code to return results.

**Key Design Decisions:**  
- Model scored on all 85,396 tracts not just the 12,694 training tracts
- Median imputation applied at scoring time using same feature set as training
- shap_explanations_all.csv replaces shap_explanations.csv as the API data source
- Full national coverage enables any US ZIP code to return results

**Next:** Prompt 017 — Interactive Choropleth Map

---

## Prompt 017 — Interactive Choropleth Map
**Date:** 2026-03-28  
**Purpose:** Add a visual choropleth map showing census tract risk tiers for ZIP searches.

**Prompt:**  
Add an interactive choropleth map to app/src/App.jsx using React Leaflet. When a user 
searches a ZIP code and results are returned, display a Leaflet map below the search bar 
showing the census tract boundaries for that ZIP code colored by risk tier: green for low, 
yellow for medium, orange for high, red for critical. Use the Census Bureau TIGERweb API 
to fetch tract GeoJSON boundaries dynamically based on the state FIPS code derived from 
the tract GEOIDs. Each tract polygon should be clickable and show a popup with the GEOID, 
risk score percentage, risk tier, and top driving factor. Install react-leaflet and leaflet 
as dependencies.

**Codex Output Summary:**  
Codex generated a full choropleth map implementation using React Leaflet with MapContainer, 
TileLayer, GeoJSON, and a custom MapBounds component that auto-fits the map to the returned 
tract boundaries. Added color mapping for all four risk tiers and clickable popups per tract.

**Key Design Decisions:**  
- React Leaflet chosen over Mapbox for zero API key requirement
- OpenStreetMap tiles used as base layer — free and no key needed
- MapBounds component auto-fits map viewport to returned tract boundaries
- Clickable popups show GEOID, risk score, risk tier, and top driving factor
- Map only renders for ZIP searches not GEOID searches

**Real-World Discoveries:**  
- Census TIGERweb API blocked by CORS when called directly from browser. Fixed by 
  proxying through FastAPI back end at GET /tracts/geojson/{state_fips}
- Fetching entire state of Texas (5,000+ tracts) caused timeout. Fixed by passing 
  specific GEOIDs as query parameter so only 10-20 tracts are fetched per search
- Tailwind CSS v3 required over v4 due to create-react-app compatibility
- Map renders correctly after both CORS fix and GEOID-specific fetch optimization
- Output: Interactive choropleth map live at localhost showing ZIP 78229 in red/yellow

**Next:** Prompt 018 — Ethics Footer

---

## Prompt 018 — Ethics Footer
**Date:** 2026-03-29  
**Purpose:** Add an ethics statement and data transparency footer to the RootScore UI.

**Prompt:**  
Add a footer to app/src/App.jsx below the main results section. The footer should include: 
a brief ethics statement that reads 'RootScore is designed for intervention, not 
surveillance. Scores are advisory and reflect neighborhood-level patterns, not individual 
circumstances. Data sources: Census ACS, Eviction Lab, CDC PLACES.', a data vintage note 
that reads 'Eviction data reflects 2016 validated records. Model trained on XGBoost with 
AUC-ROC 0.81.', and a link to the GitHub repo. Style it cleanly in muted text matching 
the existing Tailwind design.

**Codex Output Summary:**  
Codex added a styled footer below the results section with ethics statement, data vintage 
note, and GitHub repository link using muted slate text matching the existing Tailwind 
design language.

**Key Design Decisions:**  
- Ethics statement explicitly frames RootScore as intervention not surveillance
- Data vintage note is transparent about Eviction Lab 2016 coverage limitation
- AUC-ROC metric included so judges can see model quality at a glance
- GitHub link connects judges directly to the full codebase and Codex prompt log

**Results:**  
- Footer visible on all searches below result cards
- Ethics statement and data vintage note render in muted slate-500 text
- GitHub link styled in teal matching the RootScore brand color
- ZIP label added to each result card so users know which ZIP they searched

**Next:** Deployment to Public URL

## Deployment — Production Launch
**Date:** 2026-03-30  
**Purpose:** Deploy RootScore to public URLs for contest submission.

**Services Deployed:**  
- FastAPI back end → https://rootscore-api.onrender.com
- React front end → https://qroots.onrender.com

**Key Decisions:**  
- Render.com chosen for free tier, zero credit card requirement, and public URLs
- Data files uploaded directly to GitHub since they were under 100MB
- Python 3.11 pinned via PYTHON_VERSION environment variable to avoid Python 3.14 
  hash conflicts
- react-leaflet v5 used with legacy-peer-deps flag due to React 19 incompatibility 
  with v4
- Start command uses $PORT not hardcoded 8000 for Render port binding

**Real-World Discoveries:**  
- pip freeze generates Windows file:// paths that break Linux deployment. Fixed with 
  clean manually written requirements.txt
- Render caches builds — hash mismatch errors required clearing build cache and 
  setting PYTHON_VERSION environment variable
- data/processed/ and models/ excluded from .gitignore but uploaded manually to 
  GitHub for deployment

**Next:** Prompt 019 — QRoots Rebrand

## Prompt 019 — QRoots Rebrand
**Date:** 2026-03-31  
**Purpose:** Rebrand the entire project from RootScore to QRoots with updated tagline.

**Prompt:**  
Update app/src/App.jsx to rebrand from RootScore to QRoots. Change the header name to 
QRoots. Change the tagline to 'Know where you're planting roots.' Update the footer ethics 
statement to reference QRoots. Update the GitHub link to 
https://github.com/timothytroyhollis-ctrl/QRoots. Keep all functionality identical.

**Codex Output Summary:**  
Codex updated App.jsx renaming all RootScore references to QRoots, updated the tagline, 
footer ethics statement, search button label, and GitHub repository link.

**Key Design Decisions:**  
- QRoots chosen as brand name — Quality of Roots, putting down roots
- Tagline changed to "Know where you're planting roots" to reflect relocation use case
- GitHub repo renamed from RootScore to QRoots on GitHub and local remote updated
- All functionality preserved — only branding strings changed

**Real-World Discoveries:**  
- Codex reverted API_BASE_URL to localhost and TIGER_TRACTS_URL to Census direct URL.
  Both required manual correction to production Render URLs after Codex edit.
- fetchStateTractsGeoJson also reverted to state-wide fetch — restored to GEOID-specific 
  approach to avoid timeout.

**Next:** Prompt 020 — QoL Data Ingestion from DSC540

---

## Prompt 020 — QoL Data Ingestion from DSC540
**Date:** 2026-03-31  
**Purpose:** Process the DSC540 Quality of Life dataset for use in QRoots composite score.

**Prompt:**  
Write a Python script called pull_qol_data.py that processes the DSC540 Quality of Life 
dataset from data/raw/qol_ranked.csv. This file has county-level data with columns: fips, 
county, state, total_population, median_household_income, poverty_count, edu_pct, fmr_0, 
fmr_1, fmr_2, fmr_3, fmr_4, avg_walk_score, avg_transit_score, avg_bike_score, city_count, 
qol_index. Clean the data by: standardizing the fips column to 5 digits with zero-padding, 
renaming columns to snake_case, dropping city_count and hud_pop2020 columns, replacing any 
negative values with NaN. Save the cleaned output to data/processed/qol_data.csv and print 
the row count and column list.

**Data Provenance Note:**  
qol_ranked.csv was produced in prior academic work (DSC540 Data Preparation, 
Bellevue University, March 2026) which explored Transportation Access, Living Costs, 
and Quality of Life across U.S. Cities. That project used HUD FMR, Walk Score, and 
Census ACS data to build a county-level QoL index. This file is used here as a 
pre-processed data source, similar to how Eviction Lab data was downloaded and used 
directly. All QRoots-specific processing, scoring, API, and front end work was built 
entirely with Codex during this contest period.

**Codex Output Summary:**  
Codex generated pull_qol_data.py with snake_case column renaming, FIPS zero-padding, 
defensive dropping of optional columns, negative value replacement, and clean CSV output.

**Key Design Decisions:**  
- DSC540 qol_ranked.csv chosen as source — already contains Walk Score, transit, 
  bike score, education, HUD FMR, and composite QoL index at county level
- county-level data joins to tract-level data via first 5 digits of GEOID
- Negative values replaced with NaN rather than dropped to preserve row count

**Real-World Discoveries:**  
- OUTPUT_PATH was hardcoded to Windows absolute path by Codex. Fixed to relative path 
  data/processed/qol_data.csv for cross-platform compatibility.
- Output: 2,309 county rows saved to data/processed/qol_data.csv

**Next:** Prompt 021 — Build QRoots Composite Score

## Prompt 021 — Build QRoots Composite Score
**Date:** 2026-03-31  
**Purpose:** Generate a composite QRoots neighborhood score combining housing stability 
with walkability, transit, education, and affordability dimensions.

**Prompt:**  
Write a Python script called build_qroots_score.py that creates a composite QRoots 
neighborhood score by merging two datasets. Load data/processed/shap_explanations_all.csv 
which has GEOID (11-digit tract) and predicted_risk_score columns. Load 
data/processed/qol_data.csv which has fips (5-digit county), avg_walk_score, 
avg_transit_score, avg_bike_score, edu_pct, qol_index, median_household_income, and fmr_2 
columns. Join the two datasets by matching the first 5 digits of GEOID to fips. Compute a 
composite qroots_score on a 0-100 scale using these weighted components: housing stability 
40% (inverted predicted_risk_score), walkability 20% (avg_walk_score normalized 0-100), 
transit 15% (avg_transit_score normalized 0-100), education 15% (edu_pct normalized 0-100), 
affordability 10% (inverted fmr_2 normalized). Save output to data/processed/qroots_scores.csv 
with columns: GEOID, predicted_risk_score, qroots_score, housing_stability_score, walk_score, 
transit_score, education_score, affordability_score. Print row count and score distribution.

**Codex Output Summary:**  
Codex generated build_qroots_score.py with min-max normalization helper, weighted composite 
scoring, median imputation for null component scores, county-to-tract join via first 5 digits 
of GEOID, and clean deduplication on GEOID before saving.

**Key Design Decisions:**  
- Housing stability weighted highest at 40% — core differentiator from generic QoL tools
- Walk and transit scores used directly from Walk Score data in qol_data.csv
- fmr_2 (2-bedroom FMR) chosen as affordability proxy — most representative for families
- Median imputation applied per component so missing county QoL data doesn't zero out score
- Score clipped 0-100 after weighting to handle edge cases

**Results:**  
- 85,396 tracts scored successfully
- Mean score: 51.9, Std: 13.4, Min: 14.1, Max: 90.6
- Well-calibrated distribution centered near 50 with good spread

**Next:** Prompt 022 — Update API to Serve QRoots Scores

---

## Prompt 022 — Update API to Serve QRoots Scores
**Date:** 2026-03-31  
**Purpose:** Update FastAPI back end to serve QRoots composite scores alongside 
existing eviction risk data.

**Prompt:**  
Update api/main.py to load data/processed/qroots_scores.csv on startup and merge it 
with the existing shap_explanations_all.csv data. Add qroots_score, housing_stability_score, 
walk_score, transit_score, education_score, and affordability_score fields to the GET 
/tract/{geoid} and GET /zip/{zipcode} responses. For the zip endpoint include the average 
qroots_score across all returned tracts as a zip_qroots_score field at the top level of 
the response.

**Codex Output Summary:**  
Codex generated updated api/main.py loading qroots_scores.csv on startup, merging it 
with shap_explanations_all.csv via GEOID join, and adding all six QRoots score fields 
to both /tract/{geoid} and /zip/{zipcode} responses. zip_qroots_score added as average 
across tracts at the zip response top level.

**Key Design Decisions:**  
- qroots_scores.csv loaded on startup and merged via GEOID left join
- All six score fields added to both /tract and /zip responses
- zip_qroots_score computed as mean of tract qroots_scores for the ZIP
- Null score fields returned as None rather than 0 to distinguish missing from low

**Next:** Prompt 023 — Update React Front End for QRoots Dashboard

---

## Prompt 023 — QRoots Dashboard UI with Dimension Scores
**Date:** 2026-04-02  
**Purpose:** Update React front end to display QRoots composite score dashboard 
with five dimension progress bars.

**Prompt:**  
Update app/src/App.jsx to display the new QRoots composite score dimensions. When 
results are returned show a QRoots Score summary card at the top displaying the overall 
qroots_score as a large number out of 100 with a color gradient (red below 40, yellow 
40-60, green above 60). Below that show five dimension bars: Housing Stability, 
Walkability, Transit, Education, and Affordability each showing their score out of 100 
as a horizontal progress bar colored by score level. Keep the existing map and tract 
cards below. Update the zip response to show the zip_qroots_score prominently at the top.

**Codex Output Summary:**  
Codex generated QRootsSummaryCard and DimensionBar components with color-coded progress 
bars, scoreTone helper for red/amber/green coloring, and zip-level average QRoots score 
display. Added zipQRootsScore state to track zip vs tract search context.

**Key Design Decisions:**  
- scoreTone function maps scores to red/amber/green color ramps at 40 and 60 thresholds
- QRootsSummaryCard shows overall score prominently with dimension bars beside it
- DimensionBar clips values 0-100 and applies appropriate color per score level
- ZIP search uses zip_qroots_score (average across tracts) for the summary card
- Tract search uses the individual tract qroots_score for the summary card

**Results:**  
- QRoots Score dashboard live showing 29/100 for ZIP 78229
- Five dimension bars visible: Housing Stability 8, Walkability 24, Transit 12, 
  Education 35, Affordability 67
- Color coding working correctly — red for low scores, amber for medium, green for high

**Next:** Prompt 024 — Updated Footer with QRoots Methodology

---

## Prompt 024 — Updated Footer with QRoots Methodology
**Date:** 2026-04-02 
**Purpose:** Update footer to reflect QRoots as a relocation and intervention tool 
with full methodology transparency.

**Prompt:**  
Update the footer in app/src/App.jsx to better reflect QRoots as a neighborhood quality 
of life tool for both relocation research and housing intervention. Update the ethics 
statement to reference all five data sources. Update the data vintage note to include 
the composite score weights and model metrics. Keep the GitHub link unchanged.

**Codex Output Summary:**  
Codex updated the footer ethics statement to reference relocation and intervention use 
cases, listed all five data sources explicitly, and added the QRoots composite score 
weighting methodology to the data vintage note.

**Key Design Decisions:**  
- Ethics statement expanded to cover both relocation research and housing intervention
- All five data sources listed explicitly for transparency
- Composite score weights documented in footer for judge and user reference
- Walk Score data vintage note added since it reflects city-level averages not tract

**Results:**  
- Footer live on https://rootscore.onrender.com
- Full methodology visible to judges and users
- Data sources, weights, and model metrics all transparent

**Next:** Prompt 025 — README Documentation

## Prompt 025 — README Documentation
**Date:** 2026-04-02
**Purpose:** Write a comprehensive README for the QRoots GitHub repository.

**Prompt:**
Write a comprehensive README.md for the QRoots project in the root of the repository.
Include: project title and tagline, description, Features section, Data Sources section,
Tech Stack section, How It Works numbered steps, QRoots Score Methodology with weights,
Live Demo URL, Codex Build Process section, and Ethics section.

**Codex Output Summary:**
Codex generated a complete README.md with all requested sections, clean markdown
formatting, and links to the live demo and Codex prompt log.

**Key Design Decisions:**
- Ethics section explicitly prohibits use for tenant screening or surveillance
- Methodology weights documented publicly for transparency
- Codex build process section links to docs/codex-prompts.md for judges
- Live demo URL points to https://qroots.onrender.com

**Next:** Prompt 026 — OpenAI Neighborhood Summary Endpoint

---

## Prompt 026 — OpenAI Neighborhood Summary Endpoint
**Date:** 2026-04-05
**Purpose:** Add an AI-powered plain-language neighborhood summary endpoint to the API.

**Prompt:**
Update api/main.py to add a new endpoint GET /summary/{zipcode} that generates an
AI-powered neighborhood summary using the OpenAI API. Load the OpenAI API key from
openai_config.json or the OPENAI_API_KEY environment variable. When called, look up
the average QRoots scores for that ZIP, find the most common top driving factors, and
send this data to gpt-4o-mini with a prompt asking for a 3-4 sentence plain-language
neighborhood summary for someone considering moving there. Return the summary as JSON
with a single field called summary.

**Codex Output Summary:**
Codex generated the /summary/{zipcode} endpoint with ZIP lookup, metric aggregation,
top factor counting via Counter, and OpenAI chat completions call using gpt-4o-mini.
load_openai_client function reads from OPENAI_API_KEY environment variable with
fallback to openai_config.json for local development.

**Key Design Decisions:**
- gpt-4o-mini chosen for speed and low cost per summary
- OPENAI_API_KEY environment variable used on Render, config file for local dev
- Prompt instructs model to use cautious practical language and mention tradeoffs
- max_tokens set to 180 to keep summaries concise
- Exception handling returns HTTP 500 with error detail if OpenAI call fails

**Real-World Discoveries:**
- Codex used client.responses.create which is the newer Responses API — fixed to
  client.chat.completions.create for compatibility with openai==1.82.0
- OpenAI account required billing setup — 429 quota error resolved by adding credits
- OPENAI_API_KEY environment variable must be set in Render dashboard separately
  from code deployment

**Results:**
- GET /summary/78229 returns 3-4 sentence AI neighborhood summary
- Summary mentions affordability strength, housing stability concerns, limited transit
- Response time approximately 2-5 seconds due to OpenAI API call

**Next:** Prompt 027 — Logo, Tooltips, AI Summary UI, Empty State

---

## Prompt 027 — Logo, Tooltips, AI Summary UI, Engaging Empty State
**Date:** 2026-04-05
**Purpose:** Five simultaneous UI enhancements to make QRoots more engaging and informative.

**Prompt:**
Update app/src/App.jsx with five enhancements: 1) Add QRoots logo to header from
public/QRoots_logo.png. 2) Update tagline to 'Find Your Perfect Place to Grow.'
3) Add hover tooltips to each dimension bar explaining what data is included.
4) Add AI Neighborhood Summary card after QRoots summary card for ZIP searches,
calling GET /summary/{zipcode} with loading state. 5) Make empty state more engaging
with logo, tagline, and description of what QRoots does.

**Codex Output Summary:**
Codex added dimensionTooltips constant, updated DimensionBar with group-hover tooltip
using Tailwind CSS, added NeighborhoodSummaryCard component with loading state,
added useEffect to fetch summary on ZIP search, added logo to header and empty state,
and updated tagline throughout.

**Key Design Decisions:**
- Tooltips use Tailwind group-hover pattern — no external library needed
- Summary fetched in separate useEffect triggered by searchedZip state change
- Logo sized at h-40 sm:h-48 in header, h-52 sm:h-64 in empty state
- Summary card shows graceful fallback message if OpenAI call fails
- Empty state now shows logo prominently to reinforce brand on first load

**Real-World Discoveries:**
- Logo PNG is 1024x1024 with significant whitespace padding making it appear small
  at standard heights — increased size classes to compensate
- Codex reverted API_BASE_URL to localhost — corrected to production Render URL

**Results:**
- Logo visible in header and empty state
- Hover tooltips working on all five dimension bars
- AI neighborhood summary appearing after QRoots score card on ZIP searches
- Empty state shows logo with tagline and description

**Next:** Prompt 028 — Explorer Index Data Pipeline

---

## Prompt 028 — Explorer Index Data Pipeline
**Date:** 2026-04-09
**Purpose:** Build an enriched tract-level index to power the QRoots Explorer feature.

**Prompt:**
Write a Python script called build_explorer_index.py that enriches
data/processed/qroots_scores.csv to support the QRoots Explorer feature. Load
qroots_scores.csv. Extract state_fips from the first 2 digits of GEOID. Map state_fips
to state_abbr using a hardcoded dictionary of all 50 states plus DC. Load
data/processed/zip_tract_crosswalk.csv and join it to add a zip column to each tract
row using the first matching ZIP per tract. Save to data/processed/explorer_index.csv
with columns: GEOID, zip, state_fips, state_abbr, qroots_score, housing_stability_score,
walk_score, transit_score, education_score, affordability_score.

**Codex Output Summary:**
Codex generated build_explorer_index.py with state FIPS to abbreviation mapping for
all 50 states plus DC, ZIP crosswalk join using first matching ZIP per tract, and
clean deduplication on GEOID before saving.

**Key Design Decisions:**
- State derived from first 2 digits of GEOID — no additional API call needed
- First matching ZIP per tract chosen to keep one-to-one tract-to-ZIP relationship
- explorer_index.csv serves as the dedicated data source for the Explorer endpoint

**Results:**
- 85,396 rows saved to data/processed/explorer_index.csv
- All 50 states plus DC represented
- Small number of tracts have NaN zip due to crosswalk coverage gaps

**Next:** Prompt 029 — Explorer API Endpoint

---

## Prompt 029 — Explorer API Endpoint
**Date:** 2026-04-09
**Purpose:** Add GET /explore endpoint to support state-level neighborhood discovery
with custom dimension weighting and minimum score filtering.

**Prompt:**
Update api/main.py to add GET /explore endpoint. Load explorer_index.csv on startup.
Accept query parameters: state_abbr (required), min scores for each dimension, weight
for each dimension, and limit (max 25). Filter by state and minimum scores, compute
custom_score using provided weights, group by ZIP averaging all scores, rank by
custom_score descending, return top results with zip, state_abbr, custom_score, all
five avg dimension scores, and tract_count.

**Codex Output Summary:**
Codex generated the /explore endpoint with state filtering, minimum score filtering,
custom weighted scoring, ZIP-level aggregation, and ranked results. Used FastAPI Query
parameters with defaults matching the standard QRoots weights.

**Key Design Decisions:**
- Default weights match QRoots composite score weights for consistency
- ZIP-level aggregation averages all tract scores within each ZIP
- Custom score computed at tract level then averaged to ZIP level
- limit capped at 25 to prevent oversized responses

**Results:**
- GET /explore?state_abbr=TX returns top 10 Texas ZIP codes by default weighting
- GET /explore?state_abbr=TX&weight_walk=0.60&weight_housing=0.10 returns most
  walkable ZIP codes in Texas
- Weights correctly shift rankings between default and custom configurations

**Next:** Prompt 030 — Explorer UI

---

## Prompt 030 — Explorer UI with Tabs in Header
**Date:** 2026-04-09
**Purpose:** Add Explore tab to App.jsx with state selector, dimension weight sliders,
minimum score filters, ranked ZIP results, and tabs integrated into the header card.

**Prompt:**
Add an Explorer mode to app/src/App.jsx alongside the existing ZIP/tract search. Add
two tabs inside the header card: Search (existing) and Explore (new). Explore tab has:
state dropdown, five dimension weight sliders that always sum to 100 using proportional
rebalancing, five minimum score inputs, limit selector, and Find My Neighborhood button.
Call GET /explore with weights as decimals. Display results as ranked cards with ZIP,
state, custom score, and mini dimension bars. Updated header description to reference
both Search and Explore modes.

**Codex Output Summary:**
Codex added rebalanceWeights helper function, ExplorerResultCard and MiniDimensionBar
components, full Explorer form with sliders and min inputs, handleExplore async function,
and tab switching logic. Tabs moved into header card below search form for integrated UX.

**Key Design Decisions:**
- rebalanceWeights uses proportional allocation to keep sliders summing to 100
- Tabs placed inside header card rather than floating above main content
- Explorer results show rank number, ZIP, state, custom score, and all six dimension bars
- Existing Search tab functionality completely unchanged
- Header description updated to mention both Search and Explore modes

**Results:**
- Explore tab live at https://qroots.onrender.com
- State selector with all 50 states plus DC
- Weight sliders rebalance proportionally when adjusted
- Find My Neighborhood returns ranked ZIP cards with dimension breakdowns

**Next:** Prompt 031 — Resource Links on Search Result Cards

---

## Prompt 031 — Resource Links on Search Result Cards
**Date:** 2026-04-10
**Purpose:** Add contextual resource links to each tract result card in the Search tab.

**Prompt:**
Add a collapsible Resources section to the ResultCard component in app/src/App.jsx.
After the top driving factors section add a toggle button that expands to show 7
resource links generated dynamically from the tract ZIP and state: Housing Assistance
(HUD), Walk Score, Transit (Google Maps), Schools (GreatSchools), Rental Affordability
(HUD FMR), Mental Health Resources (SAMHSA findtreatment.gov), and LGBT Resources
(MAP state profile). Links requiring ZIP context show a disabled state when searched
by GEOID only. MAP LGBT Resources URL uses /equality-maps/profile_state/{STATE_ABBR}
format confirmed from MAP website.

**Codex Output Summary:**
Codex added stateInfoByFips lookup constant, resourcesOpen state to ResultCard,
collapsible Resources section with 7 dynamic links, and disabled fallback for
ZIP-dependent links when ZIP context is unavailable.

**Key Design Decisions:**
- stateInfoByFips maps state FIPS to both abbr and name for MAP URL construction
- ZIP-dependent links disabled gracefully when tract searched by GEOID only
- MAP profile URL confirmed as /equality-maps/profile_state/{ABBR} not state name
- Walk Score URL corrected from /score/zip/{zip} to /score/{zip}
- Transit URL uses +USA suffix to prevent Google Maps international geocoding

**Real-World Discoveries:**
- MAP equality maps URL uses /profile_state/{STATE_ABBR} format not state name
- Walk Score URL /score/zip/{zip} returns Tel Aviv — correct URL is /score/{zip}
- Google Maps Transit link geocoded to Tel Aviv without +USA suffix on ZIP

**Results:**
- All 7 resource links working correctly on live site
- Collapsible Show/Hide toggle working on all result cards
- LGBT Resources links to correct state MAP profile page

**Next:** Prompt 032 — LGBT Policy Score Data Pipeline

---

## Prompt 032 — LGBT Policy Score Data Pipeline
**Date:** 2026-04-10
**Purpose:** Add normalized MAP LGBT policy score as a sixth dimension to the
explorer index using hardcoded state-level policy tally scores.

**Prompt:**
Write a Python script called build_lgbt_index.py that adds a normalized LGBT policy
score to data/processed/explorer_index.csv. Use a hardcoded dictionary of MAP state
policy tally scores for all 50 states plus DC ranging from -31 to +49. Normalize to
0-100 using min-max normalization. Join on state_abbr and save updated explorer_index.csv
with new lgbt_policy_score column. Print row count and top 5 and bottom 5 states.

**Codex Output Summary:**
Codex generated build_lgbt_index.py with hardcoded MAP overall tally scores for all
50 states plus DC, min-max normalization, state_abbr join, and printed ranking summary.

**Key Design Decisions:**
- MAP overall policy tally scores hardcoded — no API available, scores change with legislation
- Min-max normalization maps -18 (MS) to 0 and 46 (DC) to 100
- lgbt_policy_score is state-level not tract-level — all tracts in a state share same score
- Script runs after build_explorer_index.py in the data pipeline

**Results:**
- 85,396 rows saved with lgbt_policy_score column added
- DC: 100.0, CA: 96.875, MA: 96.875, VT: 96.875 at top
- MS: 0.0, LA: 6.25, AR: 6.25, AL: 9.375 at bottom
- TX normalized score: 21.875

**Next:** Prompt 033 — LGBT Policy Score in Explorer API

---

## Prompt 033 — LGBT Policy Score in Explorer API
**Date:** 2026-04-10
**Purpose:** Add lgbt_policy_score as a sixth dimension to the /explore endpoint.

**Prompt:**
Update api/main.py to add lgbt_policy_score as a sixth dimension to the /explore
endpoint. Add min_lgbt (default 0) and weight_lgbt (default 0.0) query parameters.
Include lgbt_policy_score in minimum score filter, custom_score calculation, and
ZIP-level aggregation as avg_lgbt_score. Return avg_lgbt_score in each result object.

**Codex Output Summary:**
Codex added min_lgbt and weight_lgbt parameters, updated filter logic, custom_score
calculation, groupby aggregation, and result serialization to include avg_lgbt_score.

**Key Design Decisions:**
- weight_lgbt defaults to 0.0 so existing searches are unaffected
- LGBT score participates in custom_score only when weight_lgbt > 0
- avg_lgbt_score always returned in results for display in UI regardless of weight

**Results:**
- GET /explore?state_abbr=CA&weight_lgbt=1.0 returns avg_lgbt_score of 96.875
- GET /explore?state_abbr=TX&weight_lgbt=1.0 returns avg_lgbt_score of 21.875
- Scores confirmed correct against MAP tally lookup table

**Next:** Prompt 034 — LGBT Policy Slider in Explorer UI

---

## Prompt 034 — LGBT Policy Slider in Explorer UI
**Date:** 2026-04-10
**Purpose:** Add LGBT Policy as a sixth dimension weight slider and mini bar in
the Explorer tab UI.

**Prompt:**
Update app/src/App.jsx to add LGBT Policy as a sixth dimension to the Explorer tab.
Add lgbt to weightConfig with label LGBT Policy. Add weight_lgbt and min_lgbt to
exploreWeights and exploreMins state with defaults of 0. Include in handleExplore
API params. Add avg_lgbt_score MiniDimensionBar to ExplorerResultCard.

**Codex Output Summary:**
Codex added lgbt to weightConfig array, updated exploreWeights and exploreMins
initial state, added weight_lgbt and min_lgbt to handleExplore URLSearchParams,
and added LGBT Policy MiniDimensionBar to ExplorerResultCard.

**Key Design Decisions:**
- lgbt weight defaults to 0 so standard searches are unaffected until user adjusts
- rebalanceWeights automatically handles six dimensions without modification
- LGBT Policy mini bar always visible on Explorer result cards

**Results:**
- LGBT Policy slider appears in Explorer dimension weights section
- Sliding LGBT Policy to 100% correctly shifts rankings toward high-policy states
- Mini bar shows correct state-level score on all Explorer result cards

**Next:** Prompt 035 — Resource Links on Explorer Result Cards

---

## Prompt 035 — Resource Links on Explorer Result Cards
**Date:** 2026-04-10
**Purpose:** Add the same collapsible resource links from Search result cards to
Explorer result cards.

**Prompt:**
Update ExplorerResultCard in app/src/App.jsx to add a collapsible Resources section
identical to ResultCard. Build a reverse lookup from state_abbr to stateInfo using
stateInfoByFips. Generate all 7 resource links using result.zip and result.state_abbr.
Use same Show/Hide toggle, teal link styling, and disabled state pattern as ResultCard.

**Codex Output Summary:**
Codex added stateInfoByAbbr reverse lookup constant, resourcesOpen state to
ExplorerResultCard, and identical 7-link Resources section using result.zip and
result.state_abbr for dynamic URL generation.

**Key Design Decisions:**
- Reverse lookup from state_abbr to stateInfo avoids duplicating the FIPS lookup
- All 7 links available on Explorer cards since ZIP is always present in Explorer results
- Consistent UX between Search and Explorer result cards

**Results:**
- Resource links live on Explorer result cards
- All 7 links working correctly including MAP LGBT state profile
- Show/Hide toggle working on Explorer cards

**Next:** Prompt 036 — Emoji Icons on Resource Links

---

## Prompt 036 — Emoji Icons on Resource Links
**Date:** 2026-04-10
**Purpose:** Add emoji icons to all resource link labels in both ResultCard and
ExplorerResultCard for visual polish and scannability.

**Prompt:**
Update the resources array in both ResultCard and ExplorerResultCard in app/src/App.jsx
to add emoji icons to each resource label. Use these exact labels: '🏠 Housing
Assistance', '🚶 Walk Score', '🚌 Transit', '🎓 Schools', '💰 Rental Affordability',
'🧠 Mental Health Resources', '🏳️‍🌈 LGBT Resources'. Keep all href, enabled, and
disabled logic completely unchanged. Only the label strings change.

**Codex Output Summary:**
Codex updated the resources array in both ResultCard and ExplorerResultCard replacing
all seven label strings with emoji-prefixed versions. All href, enabled, and disabled
logic preserved exactly.

**Key Design Decisions:**
- Emoji chosen to match each resource category for instant visual recognition
- Labels updated in both ResultCard and ExplorerResultCard for consistency
- No logic changes — purely cosmetic label update

**Results:**
- Emoji icons visible on all resource links in Search and Explorer result cards
- Resource section feels more polished and scannable for users and judges

**Next:** Prompt 037 — Update README

---

## Prompt 037 — Update README
**Date:** 2026-04-10
**Purpose:** Update README.md to reflect all features built since the original version
including Explorer mode, LGBT Policy score, resource links, and AI neighborhood summary.

**Prompt:**
Update README.md for the QRoots project to reflect all current features. Update the
Features section to include Explorer mode with six customizable dimension weight sliders,
LGBT Policy score from MAP, collapsible resource links with seven contextual links per
neighborhood, and AI neighborhood summary powered by OpenAI gpt-4o-mini. Add Movement
Advancement Project MAP to Data Sources. Update How It Works to mention the Explore tab
and six dimensions. Update QRoots Score Methodology to note LGBT Policy as an optional
Explorer-only dimension normalized from MAP state tally scores. Keep live demo URL as
https://qroots.onrender.com and GitHub link as https://github.com/timothytroyhollis-ctrl/QRoots.

**Codex Output Summary:**
Codex updated README.md with expanded Features section, MAP added to Data Sources,
updated How It Works with seven steps covering the Explore tab, and QRoots Score
Methodology section updated to include the optional LGBT Policy Explorer dimension.

**Key Design Decisions:**
- README now accurately reflects all 37 Codex prompts worth of features
- LGBT Policy documented as Explorer-only optional dimension with MAP attribution
- Seven resource link categories listed explicitly for judges
- Ethics section preserved and unchanged

**Results:**
- README fully reflects current live app at https://qroots.onrender.com
- All data sources documented including MAP
- Methodology section transparent about both core and optional dimensions

**Next:** Prompt 038 — Shareable URLs and Copy Link Button

---

## Prompt 038 — Shareable URLs and Copy Link Button
**Date:** 2026-04-11
**Purpose:** Add shareable URL support so users can share direct links to
neighborhood results and a Copy Link button on the QRoots summary card.

**Prompt:**
Update app/src/App.jsx to support shareable URLs. When a user searches a ZIP
code update the browser URL to ?zip=XXXXX using window.history.pushState. When
they search a GEOID update the URL to ?geoid=XXXXXXXXXXX. On page load read
these URL params and if present automatically trigger the search. Add a Copy
Link button to QRootsSummaryCard that copies the current page URL to clipboard
and shows a brief Copied! confirmation that fades after 2 seconds.

**Codex Output Summary:**
Codex extracted search logic into a runSearch function called by both handleSearch
and the startup useEffect. Added window.history.pushState calls after successful
searches. Added URLSearchParams reading on mount to auto-trigger searches from
URL params. Added Copy Link button with copied state and setTimeout fade.

**Key Design Decisions:**
- runSearch extracted from handleSearch to allow programmatic search on page load
- shouldPushState parameter prevents double-pushing state on URL-triggered loads
- Copy Link placed inline with QRoots Score label for minimal footprint
- Copied! confirmation uses opacity transition not mount/unmount for smoothness

**Results:**
- Searching 78229 updates URL to ?zip=78229
- Sharing that URL auto-loads results on page visit
- Copy Link button copies current URL and shows Copied! for 2 seconds
- GEOID searches update to ?geoid=XXXXXXXXXXX

**Next:** Prompt 039 — Vibrant Landing Page Redesign

---

## Prompt 039 — Vibrant Landing Page Redesign
**Date:** 2026-04-11
**Purpose:** Make the landing page more exciting with a larger logo, vibrant
gradient, and a three-card feature showcase replacing the bland empty state.

**Prompt:**
Redesign the landing page of app/src/App.jsx. Increase logo to h-56 sm:h-64
and remove the small QRoots text label. Make background gradient more vibrant.
Replace the empty state with three feature highlight cards: Search Any
Neighborhood, Explore by What Matters, AI-Powered Insights. Style cards with
white background, rounded corners, colored emoji pill, and subtle shadow.

**Codex Output Summary:**
Codex increased logo size, removed redundant QRoots label, updated background
gradient to a richer teal/indigo multi-layer gradient, and replaced the empty
state section with a three-column feature showcase grid with emoji pill headers.

**Key Design Decisions:**
- Single large logo replaces small logo plus text label redundancy
- Feature cards give judges immediate context on app capabilities
- Three distinct emoji colors: teal for Search, indigo for Explore, emerald for AI
- Empty state now doubles as a feature explainer rather than just a placeholder

**Results:**
- Landing page feels product-forward and engaging
- Feature cards visible immediately below the header on first load
- Logo prominent at top with no redundant text label

**Next:** Prompt 040 — Roots SVG Watermark and Green Gradient

---

## Prompt 040 — Roots SVG Watermark and Green Gradient
**Date:** 2026-04-11
**Purpose:** Add a roots and branches SVG watermark behind the gradient and
deepen the background color to a richer forest green.

**Prompt:**
Add an inline SVG as a fixed full-screen background watermark with roots and
branches spreading from bottom center upward using curved path elements in
forest green #15803d at opacity-[0.07]. Update page background to a deeper
green gradient.

**Codex Output Summary:**
Codex added fixed positioned SVG with 30+ curved path elements forming a root
and branch network, updated preserveAspectRatio and viewBox. Updated background
gradient to deeper green values.

**Real-World Discoveries:**
- SVG paths positioned at y=900-1200 were off screen due to viewBox mismatch
- preserveAspectRatio xMidYMid slice clipped the visible paths
- Logo PNG has white opaque background — not transparent — making it unusable
  as a CSS watermark since it renders as a white rectangle at low opacity
- After multiple attempts to fix SVG coordinates and opacity the watermark
  approach was abandoned in favor of gradient-only background

**Key Design Decisions:**
- SVG watermark removed after repeated rendering failures
- Earthy forest green gradient chosen as replacement visual anchor
- Final gradient: radial dark forest green at top fading to lighter emerald

**Results:**
- Clean earthy green gradient live at https://qroots.onrender.com
- No watermark — gradient alone provides the nature/roots visual theme

**Next:** Prompts 041-043 — Roots Watermark Attempts and Abandonment

---

## Prompts 041-043 — Roots Watermark Attempts and Abandonment
**Date:** 2026-04-12
**Purpose:** Multiple attempts to make the SVG roots watermark visible on the
green gradient background.

**Attempts Made:**
- Prompt 041: Increased SVG opacity from 0.07 to 0.22 and deepened green gradient
- Prompt 042: Repositioned all SVG paths to y=0-900 viewBox with xMidYMin slice
  to fix off-screen rendering
- Prompt 043: Replaced SVG watermark entirely with logo PNG as image watermark

**Real-World Discoveries:**
- opacity-[0.07] was too low to see against the green gradient regardless of path position
- All SVG paths were positioned at y=900-1200 in a 1440x1200 viewBox — entirely off screen
- preserveAspectRatio xMidYMid slice was clipping the visible area
- Logo PNG has a fully opaque white background — renders as a white rectangle at low
  opacity making it invisible against the green gradient
- position fixed caused the watermark to render behind the page gradient entirely
  rather than between gradient and content
- After three prompt iterations the watermark approach was abandoned

**Key Design Decisions:**
- SVG watermark removed entirely
- Earthy green gradient retained as the visual anchor for the roots theme
- Logo in the header already conveys the roots brand — no additional watermark needed

**Results:**
- Clean earthy forest green gradient live at https://qroots.onrender.com
- Background gradient: radial dark forest green at top fading to lighter emerald

**Next:** Prompt 044 — Tree Roots Background + Neutral Blue Score Colors

---

## Prompt 044 — Tree Roots Background Redesign and Neutral Blue Score Colors
**Date:** 2026-04-12
**Purpose:** Two simultaneous changes — a final attempt at a roots watermark using
a TreeRootsBackground component with brown earthy paths matching the logo style,
and replacing the red/amber/green scoreTone palette with neutral blue to remove
implied judgment from neighborhood scores.

**Prompt:**
Make two updates to app/src/App.jsx. First, update the TreeRootsBackground component
SVG with a new design matching the QRoots logo style: thick central trunk at bottom
center with 6-8 chunky root branches spreading wide left and right across the full
page width, tapering from thick at center to thinner at tips. Use stroke colors
#3F2A1E and #5C4033, stroke widths from 18px trunk down to 4px tips, strokeLinecap
round, fill none, opacity-[0.18], position absolute, viewBox 0 0 1440 600. Second,
replace scoreTone to return neutral blue colors: below 40 text-blue-600 bg-blue-400,
40-60 text-blue-700 bg-blue-500, above 60 text-blue-800 bg-blue-600, all with
from-blue-50 to-white panel and ring-blue-200.

**Codex Output Summary:**
Codex rebuilt the TreeRootsBackground SVG with brown earthy stroke colors, chunky
trunk and branching root paths, and changed position from fixed to absolute.
Updated scoreTone to return three shades of blue replacing red/amber/green.

**Real-World Discoveries:**
- Brown roots on green background still not visible after position absolute fix
- Root paths rendered correctly in isolated SVG preview but disappeared behind
  the white/80 backdrop-blur header card and white content cards
- Cards cover the majority of the page leaving no background area to show roots
- UX feedback confirmed red/amber/green implied neighborhood quality judgment
  which is inappropriate for an advisory tool

**Key Design Decisions:**
- Roots watermark abandoned permanently — cards cover too much of the background
- Neutral blue chosen for scoreTone — communicates information without implying
  a neighborhood is good or bad
- Blue palette uses three intensity levels to preserve visual differentiation
  between score ranges without value judgment

**Results:**
- All dimension bars, score cards, and badges now render in neutral blue
- Score cards no longer imply low scores mean bad neighborhoods
- Background remains earthy green gradient

**Next:** Final contest submission on Handshake before April 30, 2026