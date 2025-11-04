from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from pathlib import Path
import pandas as pd

# 🚀 Crear app FastAPI
app = FastAPI(title="API Mapa de Riesgo / Delitos")

# 🔓 CORS: permitir frontend (ajusta allow_origins si deseas restringir)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 📁 Ruta del archivo con los datos (colócalo en backend/data/delitos.json)
DATA_PATH = Path(__file__).parent / "data" / "delitos.json"

# 📊 Cargar delitos.json
def load_delitos() -> pd.DataFrame:
    try:
        df = pd.read_json(DATA_PATH)
        # Normalizaciones mínimas
        if "lat" in df.columns:
            df["lat"] = pd.to_numeric(df["lat"], errors="coerce")
        if "lng" in df.columns:
            df["lng"] = pd.to_numeric(df["lng"], errors="coerce")

        # Asegurar tipos básicos (si vienen como string)
        for col in [
            "anio_2018","anio_2019","anio_2020","anio_2021",
            "anio_2022","anio_2023","anio_2024","anio_2025",
            "total_bogota"
        ]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")

        if "variacion_porcentaje" in df.columns:
            df["variacion_porcentaje"] = pd.to_numeric(df["variacion_porcentaje"], errors="coerce")

        # Filtrar filas sin coordenadas válidas (para el mapa)
        if {"lat","lng"}.issubset(df.columns):
            df = df.dropna(subset=["lat","lng"])

        return df
    except Exception as e:
        print("⚠️ Error cargando delitos.json:", e)
        return pd.DataFrame()

# ✅ Salud
@app.get("/")
def home():
    return {"mensaje": "✅ Backend funcionando correctamente", "archivo": str(DATA_PATH)}

# 📡 Lista de delitos con filtros opcionales
@app.get("/api/delitos")
def get_delitos(
    tipo: Optional[str] = Query(default=None, description="Filtrar por tipo (p.ej. 'Homicidios')"),
    nombre_localidad: Optional[str] = Query(default=None, description="Filtrar por localidad"),
    mes: Optional[str] = Query(default=None, description="Filtrar por periodo (p.ej. 'Ene-Sep (2024vs2025)')")
):
    df = load_delitos()
    if df.empty:
        return []

    if tipo:
        df = df[df["tipo"].astype(str).str.lower() == tipo.lower()]
    if nombre_localidad:
        df = df[df["nombre_localidad"].astype(str).str.lower() == nombre_localidad.lower()]
    if mes:
        df = df[df["mes"].astype(str).str.lower() == mes.lower()]

    return df.to_dict(orient="records")

# 📍 Endpoint optimizado para marcadores del mapa
@app.get("/api/delitos/markers")
def get_markers(
    tipo: Optional[str] = Query(default=None),
    mes: Optional[str] = Query(default=None)
):
    df = load_delitos()
    if df.empty:
        return []

    if tipo:
        df = df[df["tipo"].astype(str).str.lower() == tipo.lower()]
    if mes:
        df = df[df["mes"].astype(str).str.lower() == mes.lower()]

    # Construir respuesta ligera
    cols_exist = set(df.columns)
    out = []
    for _, r in df.iterrows():
        item = {
            "position": [float(r["lat"]), float(r["lng"])],
            "nombre_localidad": r.get("nombre_localidad"),
            "codigo_localidad": r.get("codigo_localidad"),
            "tipo": r.get("tipo"),
            "mes": r.get("mes"),
            "anio_2018": r.get("anio_2018"),
            "anio_2019": r.get("anio_2019"),
            "anio_2020": r.get("anio_2020"),
            "anio_2021": r.get("anio_2021"),
            "anio_2022": r.get("anio_2022"),
            "anio_2023": r.get("anio_2023"),
            "anio_2024": r.get("anio_2024"),
            "anio_2025": r.get("anio_2025"),
            "variacion_porcentaje": r.get("variacion_porcentaje"),
            "total_bogota": r.get("total_bogota"),
        }
        out.append(item)
    return out

# 🧠 Modelo de entrada para predicción (lo dejo como lo tenías)
class RouteRequest(BaseModel):
    points: List[List[float]]  # lista de coordenadas [[lat, lng], ...]

# 🔮 Predicción simple de riesgo
@app.post("/api/predict_route_risk")
def predict_route_risk(request: RouteRequest):
    num_points = len(request.points)
    risk_score = min(1.0, 0.1 * num_points)
    level = "Alto" if risk_score > 0.6 else "Medio" if risk_score > 0.3 else "Bajo"
    return {
        "nivel_riesgo": level,
        "puntuacion": round(risk_score, 2),
        "total_puntos": num_points
    }

# 🏁 (Opcional) Ejecutar con: uvicorn main:app --reload
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
