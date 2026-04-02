from pathlib import Path

import pandas as pd


SHAP_PATH = Path("data/processed/shap_explanations_all.csv")
QOL_PATH = Path("data/processed/qol_data.csv")
OUTPUT_PATH = Path("data/processed/qroots_scores.csv")


def require_file(path: Path) -> None:
    if not path.exists():
        raise FileNotFoundError(f"Missing input file: {path}")


def normalize_geoid(value: object) -> str:
    digits = "".join(character for character in str(value) if character.isdigit())
    return digits.zfill(11)


def normalize_fips(value: object) -> str:
    digits = "".join(character for character in str(value) if character.isdigit())
    return digits.zfill(5)


def min_max_scale(series: pd.Series, invert: bool = False) -> pd.Series:
    numeric_series = pd.to_numeric(series, errors="coerce")
    min_value = numeric_series.min()
    max_value = numeric_series.max()

    if pd.isna(min_value) or pd.isna(max_value) or min_value == max_value:
        scaled = pd.Series(50.0, index=series.index)
    else:
        scaled = ((numeric_series - min_value) / (max_value - min_value)) * 100.0

    if invert:
        scaled = 100.0 - scaled

    return scaled.clip(lower=0, upper=100)


def main() -> None:
    for path in [SHAP_PATH, QOL_PATH]:
        require_file(path)

    shap_df = pd.read_csv(SHAP_PATH, dtype={"GEOID": "string"})
    shap_df["GEOID"] = shap_df["GEOID"].astype("string").map(normalize_geoid)
    shap_df["predicted_risk_score"] = pd.to_numeric(shap_df["predicted_risk_score"], errors="coerce")
    shap_df["county_fips"] = shap_df["GEOID"].str[:5]

    qol_columns = [
        "fips",
        "avg_walk_score",
        "avg_transit_score",
        "avg_bike_score",
        "edu_pct",
        "qol_index",
        "median_household_income",
        "fmr_2",
    ]
    qol_df = pd.read_csv(QOL_PATH, usecols=qol_columns, dtype={"fips": "string"})
    qol_df["fips"] = qol_df["fips"].astype("string").map(normalize_fips)

    numeric_qol_columns = [column for column in qol_columns if column != "fips"]
    for column in numeric_qol_columns:
        qol_df[column] = pd.to_numeric(qol_df[column], errors="coerce")

    merged_df = shap_df.merge(qol_df, left_on="county_fips", right_on="fips", how="left")

    merged_df["housing_stability_score"] = (1.0 - merged_df["predicted_risk_score"]) * 100.0
    merged_df["walk_score"] = min_max_scale(merged_df["avg_walk_score"])
    merged_df["transit_score"] = min_max_scale(merged_df["avg_transit_score"])
    merged_df["education_score"] = min_max_scale(merged_df["edu_pct"])
    merged_df["affordability_score"] = min_max_scale(merged_df["fmr_2"], invert=True)

    component_columns = [
        "housing_stability_score",
        "walk_score",
        "transit_score",
        "education_score",
        "affordability_score",
    ]
    for column in component_columns:
        merged_df[column] = merged_df[column].fillna(merged_df[column].median())

    merged_df["qroots_score"] = (
        merged_df["housing_stability_score"] * 0.40
        + merged_df["walk_score"] * 0.20
        + merged_df["transit_score"] * 0.15
        + merged_df["education_score"] * 0.15
        + merged_df["affordability_score"] * 0.10
    ).clip(lower=0, upper=100)

    output_columns = [
        "GEOID",
        "predicted_risk_score",
        "qroots_score",
        "housing_stability_score",
        "walk_score",
        "transit_score",
        "education_score",
        "affordability_score",
    ]
    output_df = merged_df[output_columns].drop_duplicates(subset="GEOID", keep="first").reset_index(drop=True)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    output_df.to_csv(OUTPUT_PATH, index=False)

    print(f"Saved {len(output_df):,} rows to {OUTPUT_PATH}")
    print("QRoots score summary:")
    print(output_df["qroots_score"].describe().to_string())


if __name__ == "__main__":
    main()
