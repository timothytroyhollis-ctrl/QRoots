from pathlib import Path

import httpx
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware


SHAP_PATH = Path("data/processed/shap_explanations_all.csv")
MODELING_PATH = Path("data/processed/modeling_dataset.csv")
ZIP_CROSSWALK_PATH = Path("data/processed/zip_tract_crosswalk.csv")

RISK_LABELS = {
    "median_household_income": "Median household income",
    "rent_burden_35_plus_share": "Share of renters spending 35%+ on rent",
    "renter_occupied_units": "Renter-occupied homes",
    "total_housing_units": "Total housing units",
    "unemployment_rate_proxy": "Unemployment rate",
    "median_gross_rent": "Median gross rent",
    "poverty.rate": "Poverty rate",
    "poverty_rate": "Poverty rate",
    "depression_among_adults": "Depression among adults",
    "fair_poor_health_status": "Fair or poor health status",
    "frequent_mental_distress": "Frequent mental distress",
}

app = FastAPI(title="RootScore API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def normalize_geoid(value: str) -> str:
    digits = "".join(character for character in str(value) if character.isdigit())
    return digits.zfill(11)


def feature_label(feature_name: str) -> str:
    return RISK_LABELS.get(feature_name, feature_name.replace("_", " ").replace(".", " ").title())


def risk_tier(score: float) -> str:
    if score >= 0.85:
        return "critical"
    if score >= 0.65:
        return "high"
    if score >= 0.35:
        return "medium"
    return "low"


def build_driving_factors(row: pd.Series) -> list:
    drivers = []
    for rank in range(1, 4):
        feature_key = row.get(f"top_feature_{rank}")
        feature_value = row.get(f"top_feature_{rank}_value")
        drivers.append(
            {
                "feature": feature_key,
                "label": feature_label(str(feature_key)),
                "shap_value": None if pd.isna(feature_value) else float(feature_value),
            }
        )
    return drivers


@app.on_event("startup")
def load_data() -> None:
    if not SHAP_PATH.exists():
        raise FileNotFoundError(f"Missing SHAP explanations file: {SHAP_PATH}")
    if not MODELING_PATH.exists():
        raise FileNotFoundError(f"Missing modeling dataset file: {MODELING_PATH}")
    if not ZIP_CROSSWALK_PATH.exists():
        raise FileNotFoundError(f"Missing ZIP crosswalk file: {ZIP_CROSSWALK_PATH}")

    shap_df = pd.read_csv(SHAP_PATH, dtype={"GEOID": "string"})
    shap_df["GEOID"] = shap_df["GEOID"].astype("string").map(normalize_geoid)

    modeling_df = pd.read_csv(MODELING_PATH, dtype={"GEOID": "string"})
    modeling_df["GEOID"] = modeling_df["GEOID"].astype("string").map(normalize_geoid)

    zip_crosswalk_df = pd.read_csv(
        ZIP_CROSSWALK_PATH,
        dtype={"zip": "string", "tract_geoid": "string"},
    )
    zip_crosswalk_df["zip"] = zip_crosswalk_df["zip"].astype("string").str.extract(r"(\d+)", expand=False).str.zfill(5)
    zip_crosswalk_df["tract_geoid"] = (
        zip_crosswalk_df["tract_geoid"].astype("string").map(normalize_geoid)
    )

    app.state.shap_df = shap_df
    app.state.modeling_df = modeling_df
    app.state.zip_crosswalk_df = zip_crosswalk_df
    app.state.tract_df = shap_df.merge(modeling_df, on="GEOID", how="left", suffixes=("", "_model"))


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/tract/{geoid}")
def get_tract(geoid: str) -> dict:
    normalized_geoid = normalize_geoid(geoid)
    if len(normalized_geoid) != 11:
        raise HTTPException(status_code=400, detail="GEOID must be an 11-digit census tract code.")

    tract_df = app.state.tract_df
    tract_rows = tract_df.loc[tract_df["GEOID"] == normalized_geoid]
    if tract_rows.empty:
        raise HTTPException(status_code=404, detail="Tract not found.")

    row = tract_rows.iloc[0]
    score = float(row["predicted_risk_score"])
    return {
        "GEOID": normalized_geoid,
        "predicted_risk_score": score,
        "risk_tier": risk_tier(score),
        "top_driving_factors": build_driving_factors(row),
    }


@app.get("/zip/{zipcode}")
def get_zip(zipcode: str) -> dict:
    normalized_zip = "".join(character for character in str(zipcode) if character.isdigit()).zfill(5)
    if len(normalized_zip) != 5:
        raise HTTPException(status_code=400, detail="ZIP code must be 5 digits.")

    crosswalk_df = app.state.zip_crosswalk_df
    matched_crosswalk = crosswalk_df.loc[crosswalk_df["zip"] == normalized_zip]
    if matched_crosswalk.empty:
        raise HTTPException(status_code=404, detail="ZIP code not found in crosswalk.")

    tract_geoids = matched_crosswalk["tract_geoid"].dropna().drop_duplicates().tolist()
    tract_df = app.state.tract_df.loc[app.state.tract_df["GEOID"].isin(tract_geoids)].copy()
    tract_df = tract_df.sort_values("predicted_risk_score", ascending=False)

    tracts = []
    for _, row in tract_df.iterrows():
        score = float(row["predicted_risk_score"])
        tracts.append(
            {
                "GEOID": row["GEOID"],
                "predicted_risk_score": score,
                "risk_tier": risk_tier(score),
                "top_driving_factors": build_driving_factors(row),
            }
        )

    return {
        "zip": normalized_zip,
        "tract_count": len(tracts),
        "tracts": tracts,
    }


@app.get("/tracts/geojson/{state_fips}")
async def get_tract_geojson(state_fips: str, geoids: str = "") -> dict:
    tiger_url = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Tracts_Blocks/MapServer/0/query"

    geoid_list = [g.strip() for g in geoids.split(",") if g.strip()]
    if geoid_list:
        where_clause = "GEOID IN ('" + "','".join(geoid_list) + "')"
    else:
        where_clause = f"STATE='{state_fips}'"

    params = {
        "where": where_clause,
        "outFields": "GEOID,STATE,COUNTY,TRACT,NAME",
        "outSR": "4326",
        "f": "geojson",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(tiger_url, params=params)
        response.raise_for_status()
        return response.json()