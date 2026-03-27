from pathlib import Path

import pandas as pd


INPUT_PATH = Path("data/processed/master_dataset.csv")
OUTPUT_PATH = Path("data/processed/modeling_dataset.csv")

TARGET_COLUMN = "high_eviction_risk"

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

EVICTION_RATE_ALIASES = [
    "eviction.filing.rate",
    "eviction-filing-rate",
    "eviction_filing_rate",
]

STATE_COLUMN_ALIASES = [
    "state_fips",
    "StateAbbr",
    "state_code",
]


def resolve_column(df: pd.DataFrame, candidates: list[str], label: str) -> str:
    for candidate in candidates:
        if candidate in df.columns:
            return candidate
    raise KeyError(f"Could not find a column for {label}. Tried: {', '.join(candidates)}")


def main() -> None:
    if not INPUT_PATH.exists():
        raise FileNotFoundError(f"Missing input file: {INPUT_PATH}")

    df = pd.read_csv(INPUT_PATH, dtype={"GEOID": "string"})
    df["GEOID"] = df["GEOID"].astype("string").str.extract(r"(\d+)", expand=False).str.zfill(11)

    eviction_rate_column = resolve_column(df, EVICTION_RATE_ALIASES, "eviction filing rate")
    state_column = resolve_column(df, STATE_COLUMN_ALIASES, "state identifier")

    resolved_feature_columns: dict[str, str] = {}
    for output_name, aliases in FEATURE_ALIASES.items():
        resolved_feature_columns[output_name] = resolve_column(df, aliases, output_name)

    modeling_columns = ["GEOID", state_column, eviction_rate_column, *resolved_feature_columns.values()]
    modeling_df = df[modeling_columns].copy()
    modeling_df[eviction_rate_column] = pd.to_numeric(modeling_df[eviction_rate_column], errors="coerce")
    modeling_df = modeling_df.dropna(subset=[eviction_rate_column]).copy()

    for source_column in resolved_feature_columns.values():
        modeling_df[source_column] = pd.to_numeric(modeling_df[source_column], errors="coerce")

    state_thresholds = modeling_df.groupby(state_column)[eviction_rate_column].transform(
        lambda series: series.quantile(0.67)
    )
    modeling_df[TARGET_COLUMN] = (modeling_df[eviction_rate_column] >= state_thresholds).astype(int)

    rename_map = {
        source_column: output_name
        for output_name, source_column in resolved_feature_columns.items()
        if source_column != output_name
    }
    modeling_df = modeling_df.rename(columns=rename_map)

    feature_columns = list(FEATURE_ALIASES.keys())
    for column in feature_columns:
        median_value = modeling_df[column].median()
        modeling_df[column] = modeling_df[column].fillna(median_value)

    output_columns = ["GEOID", *feature_columns, TARGET_COLUMN]
    modeling_df = modeling_df[output_columns].drop_duplicates(subset="GEOID", keep="first").reset_index(drop=True)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    modeling_df.to_csv(OUTPUT_PATH, index=False)

    print(f"Saved {len(modeling_df):,} rows to {OUTPUT_PATH}")
    print("Class balance:")
    print(modeling_df[TARGET_COLUMN].value_counts(dropna=False).sort_index())
    print("Null counts after imputation:")
    for column, null_count in modeling_df.isna().sum().items():
        print(f"{column}: {null_count}")


if __name__ == "__main__":
    main()
