from pathlib import Path
import pandas as pd
import requests
from io import StringIO

OUTPUT_PATH = Path('data/processed/zip_tract_crosswalk.csv')
URL = 'https://www2.census.gov/geo/docs/maps-data/data/rel/zcta_tract_rel_10.txt'

def main() -> None:
    print('Downloading ZIP to tract crosswalk...')
    response = requests.get(URL, timeout=60)
    response.raise_for_status()

    df = pd.read_csv(StringIO(response.text))

    output_df = pd.DataFrame({
        'zip': df['ZCTA5'].astype(str).str.zfill(5),
        'tract_geoid': df['GEOID'].astype(str).str.zfill(11)
    })

    output_df = output_df.drop_duplicates().sort_values(['zip', 'tract_geoid']).reset_index(drop=True)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    output_df.to_csv(OUTPUT_PATH, index=False)
    print(f'✅ Saved {len(output_df):,} rows to {OUTPUT_PATH}')

if __name__ == '__main__':
    main()