from pathlib import Path

import pandas as pd


ACS_PATH = Path("data/processed/acs_tract_data.csv")
EVICTION_PATH = Path("data/processed/evictionlab_tract_data.csv")
CDC_PATH = Path("data/processed/cdc_places_data.csv")
OUTPUT_PATH = Path("data/processed/master_dataset.csv")


def require_file(path: Path) -> None:
    if not path.exists():
        raise FileNotFoundError(f"Missing input file: {path}")


def load_tract_file(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, dtype={"GEOID": "string"})
    df["GEOID"] = df["GEOID"].astype("string").str.extract(r"(\d+)", expand=False).str.zfill(11)
    return df


def main() -> None:
    for path in [ACS_PATH, EVICTION_PATH, CDC_PATH]:
        require_file(path)

    acs_df = load_tract_file(ACS_PATH)
    eviction_df = load_tract_file(EVICTION_PATH)
    cdc_df = load_tract_file(CDC_PATH)

    master_df = acs_df.copy()

    master_df = master_df.merge(
        eviction_df,
        on="GEOID",
        how="left",
        suffixes=("", "_eviction"),
    )
    master_df = master_df.merge(
        cdc_df,
        on="GEOID",
        how="left",
        suffixes=("", "_cdc"),
    )
    master_df = master_df.drop_duplicates(subset="GEOID", keep="first").reset_index(drop=True)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    master_df.to_csv(OUTPUT_PATH, index=False)

    print(f"Saved {len(master_df):,} rows to {OUTPUT_PATH}")
    print("Columns:")
    for column in master_df.columns:
        print(column)

    print("Null counts:")
    for column, null_count in master_df.isna().sum().items():
        print(f"{column}: {null_count}")


if __name__ == "__main__":
    main()
