import json
from collections import Counter
from pathlib import Path
import os

import httpx
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI


SHAP_PATH = Path("data/processed/shap_explanations_all.csv")
MODELING_PATH = Path("data/processed/modeling_dataset.csv")
ZIP_CROSSWALK_PATH = Path("data/processed/zip_tract_crosswalk.csv")
QROOTS_SCORES_PATH = Path("data/processed/qroots_scores.csv")
EXPLORER_INDEX_PATH = Path("data/processed/explorer_index.csv")
OPENAI_CONFIG_PATH = Path("openai_config.json")

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

app = FastAPI(title="QRoots API")
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


def build_driving_factors(row: pd.Series) -> list[dict]:
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


def load_openai_client() -> OpenAI:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        if OPENAI_CONFIG_PATH.exists():
            with OPENAI_CONFIG_PATH.open("r", encoding="utf-8") as f:
                config = json.load(f)
            api_key = config.get("api_key", "").strip()
    if not api_key:
        raise ValueError("OpenAI API key not found in environment or config file.")
    return OpenAI(api_key=api_key)


@app.on_event("startup")
def load_data() -> None:
    if not SHAP_PATH.exists():
        raise FileNotFoundError(f"Missing SHAP explanations file: {SHAP_PATH}")
    if not MODELING_PATH.exists():
        raise FileNotFoundError(f"Missing modeling dataset file: {MODELING_PATH}")
    if not ZIP_CROSSWALK_PATH.exists():
        raise FileNotFoundError(f"Missing ZIP crosswalk file: {ZIP_CROSSWALK_PATH}")
    if not QROOTS_SCORES_PATH.exists():
        raise FileNotFoundError(f"Missing QRoots scores file: {QROOTS_SCORES_PATH}")
    if not EXPLORER_INDEX_PATH.exists():
        raise FileNotFoundError(f"Missing explorer index file: {EXPLORER_INDEX_PATH}")

    shap_df = pd.read_csv(SHAP_PATH, dtype={"GEOID": "string"})
    shap_df["GEOID"] = shap_df["GEOID"].astype("string").map(normalize_geoid)

    modeling_df = pd.read_csv(MODELING_PATH, dtype={"GEOID": "string"})
    modeling_df["GEOID"] = modeling_df["GEOID"].astype("string").map(normalize_geoid)

    qroots_scores_df = pd.read_csv(QROOTS_SCORES_PATH, dtype={"GEOID": "string"})
    qroots_scores_df["GEOID"] = qroots_scores_df["GEOID"].astype("string").map(normalize_geoid)

    explorer_df = pd.read_csv(
        EXPLORER_INDEX_PATH,
        dtype={"GEOID": "string", "zip": "string", "state_fips": "string", "state_abbr": "string"},
    )
    explorer_df["GEOID"] = explorer_df["GEOID"].astype("string").map(normalize_geoid)
    explorer_df["zip"] = (
        explorer_df["zip"]
        .astype("string")
        .str.extract(r"(\d+)", expand=False)
        .str.zfill(5)
    )
    explorer_df["state_fips"] = (
        explorer_df["state_fips"]
        .astype("string")
        .str.extract(r"(\d+)", expand=False)
        .str.zfill(2)
    )
    explorer_df["state_abbr"] = explorer_df["state_abbr"].astype("string").str.upper()

    zip_crosswalk_df = pd.read_csv(
        ZIP_CROSSWALK_PATH,
        dtype={"zip": "string", "tract_geoid": "string"},
    )
    zip_crosswalk_df["zip"] = (
        zip_crosswalk_df["zip"]
        .astype("string")
        .str.extract(r"(\d+)", expand=False)
        .str.zfill(5)
    )
    zip_crosswalk_df["tract_geoid"] = (
        zip_crosswalk_df["tract_geoid"].astype("string").map(normalize_geoid)
    )

    app.state.shap_df = shap_df
    app.state.modeling_df = modeling_df
    app.state.qroots_scores_df = qroots_scores_df
    app.state.explorer_df = explorer_df
    app.state.zip_crosswalk_df = zip_crosswalk_df
    app.state.tract_df = (
        shap_df.merge(modeling_df, on="GEOID", how="left", suffixes=("", "_model"))
        .merge(qroots_scores_df, on="GEOID", how="left", suffixes=("", "_qroots"))
    )


@app.get("/health")
def health() -> dict[str, str]:
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
        "qroots_score": None if pd.isna(row.get("qroots_score")) else float(row["qroots_score"]),
        "housing_stability_score": None
        if pd.isna(row.get("housing_stability_score"))
        else float(row["housing_stability_score"]),
        "walk_score": None if pd.isna(row.get("walk_score")) else float(row["walk_score"]),
        "transit_score": None if pd.isna(row.get("transit_score")) else float(row["transit_score"]),
        "education_score": None
        if pd.isna(row.get("education_score"))
        else float(row["education_score"]),
        "affordability_score": None
        if pd.isna(row.get("affordability_score"))
        else float(row["affordability_score"]),
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
                "qroots_score": None if pd.isna(row.get("qroots_score")) else float(row["qroots_score"]),
                "housing_stability_score": None
                if pd.isna(row.get("housing_stability_score"))
                else float(row["housing_stability_score"]),
                "walk_score": None if pd.isna(row.get("walk_score")) else float(row["walk_score"]),
                "transit_score": None if pd.isna(row.get("transit_score")) else float(row["transit_score"]),
                "education_score": None
                if pd.isna(row.get("education_score"))
                else float(row["education_score"]),
                "affordability_score": None
                if pd.isna(row.get("affordability_score"))
                else float(row["affordability_score"]),
                "top_driving_factors": build_driving_factors(row),
            }
        )

    return {
        "zip": normalized_zip,
        "tract_count": len(tracts),
        "zip_qroots_score": None
        if tract_df["qroots_score"].dropna().empty
        else float(tract_df["qroots_score"].dropna().mean()),
        "tracts": tracts,
    }


@app.get("/summary/{zipcode}")
def get_zip_summary(zipcode: str) -> dict:
    normalized_zip = "".join(c for c in str(zipcode) if c.isdigit()).zfill(5)
    if len(normalized_zip) != 5:
        raise HTTPException(status_code=400, detail="ZIP code must be 5 digits.")

    crosswalk_df = app.state.zip_crosswalk_df
    matched = crosswalk_df.loc[crosswalk_df["zip"] == normalized_zip]
    if matched.empty:
        raise HTTPException(status_code=404, detail="ZIP code not found in crosswalk.")

    tract_geoids = matched["tract_geoid"].dropna().drop_duplicates().tolist()
    tract_df = app.state.tract_df.loc[app.state.tract_df["GEOID"].isin(tract_geoids)].copy()

    def safe_mean(col: str):
        series = tract_df[col].dropna()
        return round(float(series.mean()), 1) if not series.empty else None

    metrics = {
        "overall_qroots_score": safe_mean("qroots_score"),
        "housing_stability": safe_mean("housing_stability_score"),
        "walkability": safe_mean("walk_score"),
        "transit": safe_mean("transit_score"),
        "education": safe_mean("education_score"),
        "affordability": safe_mean("affordability_score"),
    }

    factor_counts: Counter = Counter()
    for rank in range(1, 4):
        factor_counts.update(
            feature_label(f)
            for f in tract_df[f"top_feature_{rank}"].dropna().astype(str).tolist()
        )
    top_factors = [label for label, _ in factor_counts.most_common(5)]

    prompt = (
        f"You are writing a plain-language neighborhood summary for ZIP code {normalized_zip}. "
        f"Write 3-4 sentences for someone considering moving there. Use cautious, practical "
        f"language. Avoid hype and jargon. Mention strengths and tradeoffs when appropriate.\n\n"
        f"Neighborhood scores (0-100 scale): {metrics}\n"
        f"Most common driving factors: {top_factors}\n"
        f"Number of census tracts analyzed: {len(tract_df)}"
    )

    try:
        client = load_openai_client()
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=180,
        )
        summary = response.choices[0].message.content.strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI API error: {str(e)}")

    return {"summary": summary}


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


@app.get("/explore")
def explore(
    state_abbr: str = Query(..., min_length=2, max_length=2),
    min_qroots: float = 0,
    min_housing: float = 0,
    min_walk: float = 0,
    min_transit: float = 0,
    min_education: float = 0,
    min_affordability: float = 0,
    weight_housing: float = 0.40,
    weight_walk: float = 0.20,
    weight_transit: float = 0.15,
    weight_education: float = 0.15,
    weight_affordability: float = 0.10,
    limit: int = Query(10, ge=1, le=25),
) -> dict:
    explorer_df = app.state.explorer_df.copy()
    filtered_df = explorer_df.loc[explorer_df["state_abbr"] == state_abbr.upper()].copy()

    filtered_df = filtered_df.loc[
        (filtered_df["qroots_score"] >= min_qroots)
        & (filtered_df["housing_stability_score"] >= min_housing)
        & (filtered_df["walk_score"] >= min_walk)
        & (filtered_df["transit_score"] >= min_transit)
        & (filtered_df["education_score"] >= min_education)
        & (filtered_df["affordability_score"] >= min_affordability)
    ].copy()

    if filtered_df.empty:
        raise HTTPException(status_code=404, detail="No results match the requested filters.")

    filtered_df["custom_score"] = (
        filtered_df["housing_stability_score"] * weight_housing
        + filtered_df["walk_score"] * weight_walk
        + filtered_df["transit_score"] * weight_transit
        + filtered_df["education_score"] * weight_education
        + filtered_df["affordability_score"] * weight_affordability
    )

    grouped_df = (
        filtered_df.dropna(subset=["zip"])
        .groupby("zip", as_index=False)
        .agg(
            state_abbr=("state_abbr", "first"),
            custom_score=("custom_score", "mean"),
            avg_qroots_score=("qroots_score", "mean"),
            avg_housing_stability=("housing_stability_score", "mean"),
            avg_walk_score=("walk_score", "mean"),
            avg_transit_score=("transit_score", "mean"),
            avg_education_score=("education_score", "mean"),
            avg_affordability_score=("affordability_score", "mean"),
            tract_count=("GEOID", "nunique"),
        )
        .sort_values("custom_score", ascending=False)
        .head(limit)
        .reset_index(drop=True)
    )

    if grouped_df.empty:
        raise HTTPException(status_code=404, detail="No ZIP-level results match the requested filters.")

    results = []
    for _, row in grouped_df.iterrows():
        results.append(
            {
                "zip": row["zip"],
                "state_abbr": row["state_abbr"],
                "custom_score": float(row["custom_score"]),
                "avg_qroots_score": float(row["avg_qroots_score"]),
                "avg_housing_stability": float(row["avg_housing_stability"]),
                "avg_walk_score": float(row["avg_walk_score"]),
                "avg_transit_score": float(row["avg_transit_score"]),
                "avg_education_score": float(row["avg_education_score"]),
                "avg_affordability_score": float(row["avg_affordability_score"]),
                "tract_count": int(row["tract_count"]),
            }
        )

    return {
        "state_abbr": state_abbr.upper(),
        "result_count": len(results),
        "results": results,
    }
