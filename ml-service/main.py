import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from forecasting import InsufficientDataError, forecast_stock_need

app = FastAPI(
    title="Inventori UMKM — Layanan Prediksi Stok",
    description=(
        "Layanan machine learning terpisah yang menghitung proyeksi kebutuhan "
        "stok berdasarkan tren historis transaksi keluar, dipanggil oleh "
        "aplikasi Next.js sebagai REST API."
    ),
    version="1.0.0",
)

allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


class HistoryPoint(BaseModel):
    date: str = Field(..., description="Tanggal format YYYY-MM-DD")
    quantity: float = Field(..., ge=0, description="Jumlah stok keluar pada tanggal ini")


class ForecastRequest(BaseModel):
    product_id: str
    history: list[HistoryPoint]
    horizon_days: int = Field(14, ge=1, le=90)


class PredictionPoint(BaseModel):
    date: str
    quantity: float


class ForecastResponse(BaseModel):
    product_id: str
    method: str
    data_points_used: int
    daily_trend_slope: float
    recent_daily_average: float
    total_horizon_need: float
    predictions: list[PredictionPoint]


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/forecast", response_model=ForecastResponse)
def forecast(request: ForecastRequest):
    try:
        result = forecast_stock_need(
            history=[point.model_dump() for point in request.history],
            horizon_days=request.horizon_days,
        )
    except InsufficientDataError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    return {"product_id": request.product_id, **result}
