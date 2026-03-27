from pathlib import Path

import joblib
import pandas as pd
import shap


MODEL_PATH = Path("models/xgboost_model.pkl")
FEATURES_PATH = Path("models/feature_columns.pkl")
DATA_PATH = Path("data/processed/modeling_dataset.csv")
OUTPUT_PATH = Path("data/processed/shap_explanations.csv")
TARGET_COLUMN = "high_eviction_risk"


def require_file(path: Path) -> None:
    if not path.exists():
        raise FileNotFoundError(f"Missing input file: {path}")


def main() -> None:
    for path in [MODEL_PATH, FEATURES_PATH, DATA_PATH]:
        require_file(path)

    model = joblib.load(MODEL_PATH)
    feature_columns = joblib.load(FEATURES_PATH)

    df = pd.read_csv(DATA_PATH, dtype={"GEOID": "string"})
    df["GEOID"] = df["GEOID"].astype("string").str.extract(r"(\d+)", expand=False).str.zfill(11)

    missing_features = [column for column in feature_columns if column not in df.columns]
    if missing_features:
        raise KeyError(f"Missing feature columns in modeling dataset: {missing_features}")

    X = df[feature_columns].copy()
    predicted_risk_scores = model.predict_proba(X)[:, 1]

    explainer = shap.Explainer(model, X)
    shap_explanation = explainer(X)
    shap_values = shap_explanation.values

    records = []
    for row_index, geoid in enumerate(df["GEOID"]):
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

    explanation_df = pd.DataFrame.from_records(records)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    explanation_df.to_csv(OUTPUT_PATH, index=False)

    print(explanation_df.head().to_string(index=False))


if __name__ == "__main__":
    main()
