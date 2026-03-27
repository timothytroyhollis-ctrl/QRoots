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
*(To be filled in after Codex generates the updated script)*

**Key Design Decisions:**  
- HUD dropped due to metro-area join key mismatch with tract-level GEOID
- FRED dropped in Prompt 007 revision — ACS unemployment_rate_proxy is sufficient
- Deduplication on GEOID keeps first occurrence to resolve 11 duplicate tract rows
- Final three sources: ACS (85,396 tracts), Eviction Lab (15,217 tracts), CDC PLACES 
  (78,815 tracts)

**Next:** Prompt 009 — Feature Engineering and Target Variable Creation
