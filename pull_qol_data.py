from pathlib import Path

import pandas as pd


INPUT_PATH = Path("data/raw/qol_ranked.csv")
OUTPUT_PATH = Path("data/processed/qol_data.csv")

DROP_COLUMNS = ["city_count", "hud_pop2020"]


def to_snake_case(column_name: str) -> str:
    return column_name.strip().lower().replace(" ", "_").replace("-", "_")


def main() -> None:
    if not INPUT_PATH.exists():
        raise FileNotFoundError(f"Missing input file: {INPUT_PATH}")

    df = pd.read_csv(INPUT_PATH)
    df = df.rename(columns={column: to_snake_case(column) for column in df.columns})

    if "fips" not in df.columns:
        raise KeyError("Expected a 'fips' column in the quality of life dataset.")

    df["fips"] = (
        df["fips"]
        .astype("string")
        .str.extract(r"(\d+)", expand=False)
        .str.zfill(5)
    )

    columns_to_drop = [column for column in DROP_COLUMNS if column in df.columns]
    if columns_to_drop:
        df = df.drop(columns=columns_to_drop)

    for column in df.columns:
        if column in {"county", "state", "fips"}:
            continue

        df[column] = pd.to_numeric(df[column], errors="coerce")
        df.loc[df[column] < 0, column] = pd.NA

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_PATH, index=False)

    print(f"Saved {len(df):,} rows to {OUTPUT_PATH}")
    print("Columns:")
    for column in df.columns:
        print(column)


if __name__ == "__main__":
    main()
