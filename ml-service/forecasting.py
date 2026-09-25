"""Model prediksi kebutuhan stok — sengaja dibuat sederhana & transparan
(tren linear + rata-rata bergerak + faktor musiman hari-dalam-minggu) agar
mudah dijelaskan ke pengguna UMKM non-teknis, alih-alih model black-box.
"""

from __future__ import annotations

from datetime import timedelta

import numpy as np
import pandas as pd

MIN_DATA_POINTS = 7
MOVING_AVERAGE_WINDOW = 7


class InsufficientDataError(Exception):
    pass


def _build_daily_series(history: list[dict]) -> pd.Series:
    """Susun histori (mungkin ada tanggal bolong) menjadi deret harian penuh,
    tanggal yang tidak tercatat transaksinya dianggap kuantitas 0."""
    df = pd.DataFrame(history)
    df["date"] = pd.to_datetime(df["date"])
    df = df.groupby("date")["quantity"].sum()

    full_range = pd.date_range(df.index.min(), df.index.max(), freq="D")
    return df.reindex(full_range, fill_value=0)


def _weekday_seasonality(series: pd.Series) -> dict[int, float]:
    """Rasio rata-rata tiap hari-dalam-minggu terhadap rata-rata keseluruhan."""
    overall_mean = series.mean()
    if overall_mean <= 0:
        return {weekday: 1.0 for weekday in range(7)}

    factors: dict[int, float] = {}
    for weekday in range(7):
        values = series[series.index.weekday == weekday]
        factors[weekday] = float(values.mean() / overall_mean) if len(values) > 0 else 1.0
    return factors


def forecast_stock_need(history: list[dict], horizon_days: int) -> dict:
    """
    history: [{"date": "YYYY-MM-DD", "quantity": number}, ...] — kuantitas
             stok keluar harian (boleh tidak berurutan/bolong).
    horizon_days: jumlah hari ke depan yang diproyeksikan.

    Return dict berisi daftar prediksi harian beserta metadata model.
    """
    if len(history) < MIN_DATA_POINTS:
        raise InsufficientDataError(
            f"Butuh minimal {MIN_DATA_POINTS} titik data histori, tersedia {len(history)}"
        )

    series = _build_daily_series(history)
    if len(series) < MIN_DATA_POINTS:
        raise InsufficientDataError(
            f"Rentang tanggal histori terlalu pendek (minimal {MIN_DATA_POINTS} hari)"
        )

    day_index = np.arange(len(series))
    values = series.to_numpy(dtype=float)

    # Tren linear (regresi linear derajat 1) atas seluruh histori.
    slope, intercept = np.polyfit(day_index, values, 1)

    # Rata-rata bergerak dari beberapa hari terakhir sebagai penstabil,
    # dicampur dengan proyeksi tren agar tidak terlalu liar mengikuti garis.
    recent_avg = float(series.tail(MOVING_AVERAGE_WINDOW).mean())

    weekday_factors = _weekday_seasonality(series)

    last_date = series.index.max()
    predictions = []
    for step in range(1, horizon_days + 1):
        future_index = len(series) - 1 + step
        trend_value = slope * future_index + intercept
        blended = 0.6 * trend_value + 0.4 * recent_avg

        future_date = last_date + timedelta(days=step)
        factor = weekday_factors.get(int(future_date.weekday()), 1.0)
        predicted = max(0.0, blended * factor)

        predictions.append(
            {
                "date": future_date.strftime("%Y-%m-%d"),
                "quantity": round(predicted, 1),
            }
        )

    total_horizon_need = round(sum(p["quantity"] for p in predictions), 1)

    return {
        "method": "linear_trend_moving_average_weekday_seasonality",
        "data_points_used": len(series),
        "daily_trend_slope": round(float(slope), 3),
        "recent_daily_average": round(recent_avg, 2),
        "total_horizon_need": total_horizon_need,
        "predictions": predictions,
    }
