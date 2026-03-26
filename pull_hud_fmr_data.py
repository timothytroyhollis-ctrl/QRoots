import json
import os
from pathlib import Path
from typing import Dict, List

import pandas as pd
import requests


HUD_FMR_YEAR = 2022
HUD_BASE_URL = "https://www.huduser.gov/hudapi/public/fmr"
OUTPUT_PATH = Path("data/processed/hud_fmr_data.csv")
CONFIG_PATH = Path("hud_config.json")


def load_hud_token() -> str:
    env_token = os.getenv("HUD_API_TOKEN")
    if env_token and env_token.strip():
        return env_token.strip()

    if CONFIG_PATH.exists():
        with CONFIG_PATH.open("r", encoding="utf-8") as config_file:
            config = json.load(config_file)

        for key in ("api_token", "API_TOKEN", "hud_api_token", "HUD_API_TOKEN", "token"):
            value = config.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()

    raise FileNotFoundError(
        "Missing HUD API token. Set HUD_API_TOKEN or add hud_config.json with a token."
    )


def fetch_json(url: str, token: str, params: Dict[str, int] | None = None) -> Dict:
    response = requests.get(
        url,
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
        params=params,
        timeout=60,
    )
    response.raise_for_status()
    return response.json()


def fetch_states(token: str) -> List[Dict]:
    payload = fetch_json(f"{HUD_BASE_URL}/listStates", token)
    return payload


def fetch_state_counties(state_code: str, token: str) -> List[Dict]:
    payload = fetch_json(
        f"{HUD_BASE_URL}/statedata/{state_code}",
        token,
        params={"year": HUD_FMR_YEAR},
    )
    return payload["data"].get("metroareas", [])


def build_dataframe(records: List[Dict]) -> pd.DataFrame:
    df = pd.DataFrame.from_records(records)

    rename_map = {
    "statecode": "state_code",
    "metro_name": "county_name",
    "code": "fips_code",
    "Efficiency": "fmr_0br",
    "One-Bedroom": "fmr_1br",
    "Two-Bedroom": "fmr_2br",
    "Three-Bedroom": "fmr_3br",
    "Four-Bedroom": "fmr_4br",
}
    df = df.rename(columns=rename_map)

    df["fips_code"] = df["fips_code"].astype(str).str.extract(r"(\d{1,5})$", expand=False).str.zfill(5)

    numeric_columns = ["fmr_0br", "fmr_1br", "fmr_2br", "fmr_3br", "fmr_4br"]
    for column in numeric_columns:
        df[column] = pd.to_numeric(df[column], errors="coerce")

    keep_columns = [
        "fips_code",
        "county_name",
        "state_code",
        "fmr_0br",
        "fmr_1br",
        "fmr_2br",
        "fmr_3br",
        "fmr_4br",
    ]
    return df[keep_columns].sort_values("fips_code").reset_index(drop=True)


def main() -> None:
    token = load_hud_token()
    states = fetch_states(token)

    county_records: List[Dict] = []
    for state in states:
        state_code = state["state_code"]
        county_records.extend(fetch_state_counties(state_code, token))

    fmr_df = build_dataframe(county_records)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    fmr_df.to_csv(OUTPUT_PATH, index=False)

    print(f"Saved {len(fmr_df):,} rows to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
