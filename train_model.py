from pathlib import Path

import joblib
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, f1_score, roc_auc_score
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier


INPUT_PATH = Path("data/processed/modeling_dataset.csv")
MODEL_PATH = Path("models/xgboost_model.pkl")
FEATURES_PATH = Path("models/feature_columns.pkl")
TARGET_COLUMN = "high_eviction_risk"


def print_model_metrics(name: str, y_true: pd.Series, y_pred: pd.Series, y_proba: pd.Series) -> tuple[float, float]:
    f1 = f1_score(y_true, y_pred)
    auc = roc_auc_score(y_true, y_proba)

    print(f"{name} metrics:")
    print(classification_report(y_true, y_pred, digits=4))
    print(f"F1 score: {f1:.4f}")
    print(f"AUC-ROC: {auc:.4f}")
    print()

    return f1, auc


def main() -> None:
    if not INPUT_PATH.exists():
        raise FileNotFoundError(f"Missing input file: {INPUT_PATH}")

    df = pd.read_csv(INPUT_PATH, dtype={"GEOID": "string"})
    if TARGET_COLUMN not in df.columns:
        raise KeyError(f"Missing target column: {TARGET_COLUMN}")

    feature_columns = [column for column in df.columns if column not in {"GEOID", TARGET_COLUMN}]
    X = df[feature_columns]
    y = pd.to_numeric(df[TARGET_COLUMN], errors="raise")

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    logistic_model = LogisticRegression(
        class_weight="balanced",
        max_iter=1000,
        random_state=42,
    )
    logistic_model.fit(X_train, y_train)
    logistic_pred = logistic_model.predict(X_test)
    logistic_proba = logistic_model.predict_proba(X_test)[:, 1]
    logistic_f1, logistic_auc = print_model_metrics(
        "Logistic Regression",
        y_test,
        logistic_pred,
        logistic_proba,
    )

    positive_count = int((y_train == 1).sum())
    negative_count = int((y_train == 0).sum())
    scale_pos_weight = negative_count / positive_count if positive_count else 1.0

    xgb_model = XGBClassifier(
        n_estimators=300,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        objective="binary:logistic",
        eval_metric="logloss",
        random_state=42,
        scale_pos_weight=scale_pos_weight,
    )
    xgb_model.fit(X_train, y_train)
    xgb_pred = xgb_model.predict(X_test)
    xgb_proba = xgb_model.predict_proba(X_test)[:, 1]
    xgb_f1, xgb_auc = print_model_metrics(
        "XGBoost",
        y_test,
        xgb_pred,
        xgb_proba,
    )

    best_model_name = "XGBoost"
    best_model = xgb_model
    best_f1 = xgb_f1
    best_auc = xgb_auc

    if logistic_f1 > xgb_f1:
        best_model_name = "Logistic Regression"
        best_model = logistic_model
        best_f1 = logistic_f1
        best_auc = logistic_auc

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(best_model, MODEL_PATH)
    joblib.dump(feature_columns, FEATURES_PATH)

    print(f"Best model saved to {MODEL_PATH}: {best_model_name}")
    print(f"Best model F1 score: {best_f1:.4f}")
    print(f"Best model AUC-ROC: {best_auc:.4f}")
    print(f"Feature columns saved to {FEATURES_PATH}")


if __name__ == "__main__":
    main()
