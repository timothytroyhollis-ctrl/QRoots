from pathlib import Path

import joblib
import pandas as pd
import shap


MODEL_PATH = Path("models/xgboost_model.pkl")
FEATURES_PATH = Path("models/feature_columns.pkl")
MASTER_DATA_PATH = Path("data/processed/master_dataset.csv")
OUTPUT_PATH = Path("data/processed/shap_explanations_all.csv")

FEATURE_ALIASES = {
    "median_household_income": ["median_household_income"],
    "rent_burden_35_plus_share": ["rent_burden_35_plus_share"],
    "renter_occupied_units": ["renter_occupied_units"],
    "total_housing_units": ["total_housing_units"],
    "unemployment_rate_proxy": ["unemployment_rate_proxy"],
    "median_gross_rent": ["median_gross_rent"],
    "poverty.rate": ["poverty.rate", "poverty-rate", "poverty_rate"],
    "depression_among_adults": ["depression_among_adults"],
    "fair_poor_health_status": ["fair_poor_health_status", "fair_or_poor_health"],
    "frequent_mental_distress": ["frequent_mental_distress"],
}


def require_file(path: Path) -> None:
    if not path.exists():
        raise FileNotFoundError(f"Missing input file: {path}")


def resolve_column(df: pd.DataFrame, feature_name: str) -> str:
    candidates = FEATURE_ALIASES.get(feature_name, [feature_name])
    for candidate in candidates:
        if candidate in df.columns:
            return candidate
    raise KeyError(f"Could not find source column for feature '{feature_name}'. Tried: {candidates}")


def normalize_geoid(value: object) -> str:
    digits = "".join(character for character in str(value) if character.isdigit())
    return digits.zfill(11)


def main() -> None:
    for path in [MODEL_PATH, FEATURES_PATH, MASTER_DATA_PATH]:
        require_file(path)

    model = joblib.load(MODEL_PATH)
    feature_columns = joblib.load(FEATURES_PATH)

    master_df = pd.read_csv(MASTER_DATA_PATH, dtype={"GEOID": "string"})
    master_df["GEOID"] = master_df["GEOID"].astype("string").map(normalize_geoid)

    resolved_columns = {feature: resolve_column(master_df, feature) for feature in feature_columns}

    feature_df = pd.DataFrame(index=master_df.index)
    for feature_name, source_column in resolved_columns.items():
        feature_df[feature_name] = pd.to_numeric(master_df[source_column], errors="coerce")

    for feature_name in feature_columns:
        median_value = feature_df[feature_name].median()
        feature_df[feature_name] = feature_df[feature_name].fillna(median_value)

    predicted_risk_scores = model.predict_proba(feature_df[feature_columns])[:, 1]

    explainer = shap.Explainer(model, feature_df[feature_columns])
    shap_explanation = explainer(feature_df[feature_columns])
    shap_values = shap_explanation.values

    records = []
    for row_index, geoid in enumerate(master_df["GEOID"]):
        row_shap = pd.Series(shap_values[row_index], index=feature_columns)
        top_features = row_shap.abs().sort_values(ascending=False).head(3).index.tolist()

        record = {
            "GEOID": geoid,
            "predicted_risk_score": float(predicted_risk_scores[row_index]),
        }

        for rank, feature_name in enumerate(top_features, start=1):
            record[f"top_feature_{rank}"] = feature_name
            record[f"top_feature_{rank}_value"] = float(row_shap[feature_name])

        records.append(record)

    output_df = pd.DataFrame.from_records(records)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    output_df.to_csv(OUTPUT_PATH, index=False)

    print(f"Saved {len(output_df):,} rows to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
