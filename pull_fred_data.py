import json
from pathlib import Path
from typing import List

import pandas as pd
import requests
from fredapi import Fred


CONFIG_PATH = Path('fred_config.json')
OUTPUT_PATH = Path('data/processed/fred_data.csv')
COUNTY_LIST_URL = 'https://api.census.gov/data/2022/acs/acs5'


def load_api_key() -> str:
    if not CONFIG_PATH.exists():
        raise FileNotFoundError(f'Missing config file: {CONFIG_PATH}')

    with CONFIG_PATH.open('r', encoding='utf-8') as config_file:
        config = json.load(config_file)

    api_key = config.get('api_key')
    if not isinstance(api_key, str) or not api_key.strip():
        raise KeyError(f"Missing 'api_key' in {CONFIG_PATH}")

    return api_key.strip()


def fetch_counties() -> pd.DataFrame:
    response = requests.get(
        COUNTY_LIST_URL,
        params={'get': 'NAME', 'for': 'county:*'},
        timeout=60,
    )
    response.raise_for_status()
    rows = response.json()

    counties = pd.DataFrame(rows[1:], columns=rows[0])
    counties = counties.rename(
        columns={
            'NAME': 'county_name',
            'state': 'state_fips',
            'county': 'county_fips',
        }
    )
    counties['fips_code'] = (
        counties['state_fips'].astype(str).str.zfill(2)
        + counties['county_fips'].astype(str).str.zfill(3)
    )
    return counties[['fips_code', 'county_name']].sort_values('fips_code').reset_index(drop=True)


def fetch_latest_unemployment_rate(fred: Fred, fips_code: str):
    series_id = f'{fips_code}UR'
    try:
        series = fred.get_series(series_id)
    except Exception:
        return pd.NA

    if series is None or series.empty:
        return pd.NA

    series = pd.to_numeric(series, errors='coerce').dropna()
    if series.empty:
        return pd.NA

    latest_year = series.index.max().year
    annual_series = series[series.index.year == latest_year]
    if annual_series.empty:
        return pd.NA

    return float(annual_series.mean())


def main() -> None:
    api_key = load_api_key()
    fred = Fred(api_key=api_key)

    counties = fetch_counties()
    unemployment_rates = []

    print(f'📍 Fetching unemployment rates for {len(counties):,} counties...')
    for i, fips_code in enumerate(counties['fips_code'], 1):
        unemployment_rates.append(fetch_latest_unemployment_rate(fred, fips_code))
        if i % 100 == 0:
            print(f'  ✅ {i:,}/{len(counties):,} counties processed...')

    output_df = counties.copy()
    output_df['fips_code'] = output_df['fips_code'].astype(str).str.zfill(5)
    output_df['unemployment_rate'] = unemployment_rates

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    output_df.to_csv(OUTPUT_PATH, index=False)

    print(f'✅ Saved {len(output_df):,} rows to {OUTPUT_PATH}')


if __name__ == '__main__':
    main()