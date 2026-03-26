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

**Next:** Prompt 005 — CDC PLACES Ingestion Script
