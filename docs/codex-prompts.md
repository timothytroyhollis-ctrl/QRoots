# RootScore — Codex Prompt Log
**Project:** RootScore — Neighborhood Eviction Risk Tool  
**Contest:** OpenAI Codex Contest 2026  
**Author:** Tim Slimak  
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