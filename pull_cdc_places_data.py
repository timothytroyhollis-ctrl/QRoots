from pathlib import Path

import pandas as pd


INPUT_PATH = Path(
    "data/raw/PLACES__Local_Data_for_Better_Health,_Census_Tract_Data,_2025_release_20260326.csv"
)
OUTPUT_PATH = Path("data/processed/cdc_places_data.csv")

KEEP_COLUMNS = [
    "LocationID",
    "StateAbbr",
    "StateDesc",
    "LocationName",
    "Category",
    "Measure",
    "Data_Value",
    "TotalPopulation",
]

TARGET_MEASURES = [
    'Frequent mental distress among adults',
    'Depression among adults',
    'Fair or poor self-rated health status among adults',
]

MEASURE_RENAME = {
    'Frequent mental distress among adults': 'frequent_mental_distress',
    'Depression among adults': 'depression_among_adults',
    'Fair or poor self-rated health status among adults': 'fair_poor_health_status',
}


def main() -> None:
    if not INPUT_PATH.exists():
        raise FileNotFoundError(f'Missing input file: {INPUT_PATH}')

    df = pd.read_csv(INPUT_PATH, usecols=['LocationID', 'StateAbbr', 'Measure', 'Data_Value', 'TotalPopulation'])
    df = df.loc[df['Measure'].isin(TARGET_MEASURES)].copy()

    df = df.rename(columns={'LocationID': 'GEOID'})
    df['GEOID'] = df['GEOID'].astype(str).str.extract(r'(\d+)', expand=False).str.zfill(11)
    df['Data_Value'] = pd.to_numeric(df['Data_Value'], errors='coerce')
    df['TotalPopulation'] = pd.to_numeric(df['TotalPopulation'], errors='coerce')

    pivot_df = df.pivot_table(
        index=['GEOID', 'StateAbbr'],
        columns='Measure',
        values='Data_Value',
        aggfunc='first'
    ).rename(columns=MEASURE_RENAME).reset_index()

    pivot_df.columns.name = None
    pivot_df = pivot_df.sort_values('GEOID').reset_index(drop=True)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    pivot_df.to_csv(OUTPUT_PATH, index=False)
    print(f'Saved {len(pivot_df):,} rows to {OUTPUT_PATH}')


if __name__ == "__main__":
    main()
