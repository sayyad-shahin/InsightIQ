from typing import Any

import numpy as np
import pandas as pd

from app.models.forecast import ForecastModelType


class ForecastError(ValueError):
    """Raised when a forecast cannot be produced from the given inputs."""


def _numeric_series(df: pd.DataFrame, target_column: str) -> pd.Series:
    if target_column not in df.columns:
        raise ForecastError(f"Column '{target_column}' not found in dataset")
    series = pd.to_numeric(df[target_column], errors="coerce").dropna()
    if len(series) < 3:
        raise ForecastError(
            f"Column '{target_column}' has too few numeric points ({len(series)}) to forecast"
        )
    return series.reset_index(drop=True)


def _sklearn_forecast(series: pd.Series, horizon: int) -> dict[str, Any]:
    from sklearn.linear_model import LinearRegression

    x = np.arange(len(series)).reshape(-1, 1)
    y = series.to_numpy(dtype=float)
    model = LinearRegression().fit(x, y)

    future_x = np.arange(len(series), len(series) + horizon).reshape(-1, 1)
    predictions = model.predict(future_x)

    return {
        "model_used": ForecastModelType.SKLEARN_REGRESSION.value,
        "history": [round(float(v), 6) for v in y.tolist()],
        "forecast": [round(float(v), 6) for v in predictions.tolist()],
        "horizon_periods": horizon,
        "trend_slope": round(float(model.coef_[0]), 6),
    }


def _prophet_forecast(series: pd.Series, horizon: int) -> dict[str, Any]:
    from prophet import Prophet  # lazy: heavy optional dependency

    frame = pd.DataFrame(
        {
            "ds": pd.date_range(end=pd.Timestamp.utcnow().normalize(), periods=len(series), freq="D"),
            "y": series.to_numpy(dtype=float),
        }
    )
    model = Prophet()
    model.fit(frame)
    future = model.make_future_dataframe(periods=horizon, freq="D")
    forecast = model.predict(future).tail(horizon)

    return {
        "model_used": ForecastModelType.PROPHET.value,
        "history": [round(float(v), 6) for v in series.tolist()],
        "forecast": [round(float(v), 6) for v in forecast["yhat"].tolist()],
        "forecast_dates": [d.date().isoformat() for d in forecast["ds"]],
        "horizon_periods": horizon,
    }


def compute_forecast(
    df: pd.DataFrame, target_column: str, model_type: ForecastModelType, horizon: int
) -> dict[str, Any]:
    """Produce a forecast result dict. Prophet falls back to sklearn if unavailable."""
    series = _numeric_series(df, target_column)

    if model_type == ForecastModelType.PROPHET:
        try:
            return _prophet_forecast(series, horizon)
        except ImportError:
            result = _sklearn_forecast(series, horizon)
            result["note"] = "Prophet is not installed; used linear regression instead."
            return result

    return _sklearn_forecast(series, horizon)
