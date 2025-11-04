// App.jsx
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvent,
  CircleMarker,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "leaflet-routing-machine";
import "leaflet.heat";
import axios from "axios";
import SearchBox from "./components/SearchBox.jsx";

// ================== Clustering opcional ==================
let MarkerClusterGroup = null;
try {
  require("leaflet.markercluster");
  require("leaflet.markercluster/dist/MarkerCluster.css");
  require("leaflet.markercluster/dist/MarkerCluster.Default.css");
  MarkerClusterGroup = require("react-leaflet-markercluster").default;
} catch {
  MarkerClusterGroup = null;
}

// ================== Iconos base Leaflet ==================
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ================== Cliente API ==================
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000",
  timeout: 12000,
});

// ===== helper ancho sidebar =====
const getSidebarWidth = () => {
  if (typeof window === "undefined") return 360;
  return Math.min(360, Math.round(window.innerWidth * 0.92));
};

// ================== Estilos ==================
const styles = {
  app: {
    display: "flex",
    height: "calc(var(--vh, 1vh) * 100)",
    width: "100%",
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto",
    overflow: "hidden",
    background: "#0b1224",
    position: "relative",
  },
  sidebar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 360,
    maxWidth: "92vw",
    background: "rgba(7, 16, 40, 0.7)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    color: "#e6eef8",
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    boxShadow: "2px 0 24px rgba(0,0,0,0.5)",
    zIndex: 4000,
    borderRight: "1px solid rgba(255,255,255,0.08)",
    transform: "translateX(-110%)",
    transition: "transform .3s ease, opacity .3s ease",
    opacity: 0,
  },
  sidebarOpen: {
    transform: "translateX(0)",
    opacity: 1,
  },
  title: { color: "#60a5fa", fontSize: 18, fontWeight: 800, letterSpacing: 0.2 },
  small: { color: "#9fb4c9", fontSize: 12.5 },
  mapWrap: { flex: 1, position: "relative", minWidth: 0 },
  floatingControls: {
    position: "absolute",
    right: 16,
    top: 16,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    zIndex: 9999,
  },
  fab: {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.08)",
    cursor: "pointer",
    background: "rgba(255,255,255,0.06)",
    color: "#e6eef8",
    backdropFilter: "blur(4px)",
  },
  // Botón hamburguesa más visible
  hamburger: {
    position: "absolute",
    left: 12,
    top: 12,
    zIndex: 10000,
    padding: "12px 14px",
    borderRadius: 14,
    border: "2px solid rgba(255,255,255,0.9)",
    background: "rgba(2,10,28,0.9)",
    color: "#e6eef8",
    cursor: "pointer",
    boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
    outline: "none",
    transition: "transform .08s ease, box-shadow .2s ease, background .2s ease",
    backdropFilter: "blur(6px)",
  },
  bottomPanel: {
    position: "absolute",
    right: 12,
    bottom: 14,
    zIndex: 9999,
    background: "linear-gradient(180deg, rgba(8,10,14,0.85), rgba(4,6,12,0.95))",
    borderRadius: 14,
    padding: 12,
    boxShadow: "0 8px 30px rgba(2,6,23,0.6)",
    color: "#e6eef8",
    display: "flex",
    gap: 14,
    alignItems: "center",
    transition: "transform .2s ease, opacity .2s ease, left .25s ease",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  bottomLeft: { flex: 1, minWidth: 0 },
  instrBox: { marginTop: 6, fontSize: 14, color: "#cfe8ff" },
  subtle: { color: "#86a6bf", fontSize: 12 },
};

// ================== Utils ==================
function toRad(deg) { return (deg * Math.PI) / 180; }
function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
const formatDistance = (m) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`);
const formatTimeMin = (s) => `${(s / 60).toFixed(1)} min`;

// ================== Hook de voz simple ==================
function useVoice(lang = "es-CO", rate = 1, pitch = 1) {
  const synth = (typeof window !== "undefined" && window.speechSynthesis) ? window.speechSynthesis : null;
  const [voicesReady, setVoicesReady] = useState(false);
  useEffect(() => {
    if (!synth) return;
    const load = () => setVoicesReady((synth.getVoices() || []).length > 0);
    load();
    synth.onvoiceschanged = load;
    const t = setTimeout(load, 300);
    return () => { if (synth) synth.onvoiceschanged = null; clearTimeout(t); };
  }, [synth]);

  const speak = useCallback((text) => {
    if (!synth || !text) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang; u.rate = rate; u.pitch = pitch;
    try { synth.cancel(); } catch {}
    synth.speak(u);
  }, [synth, lang, rate, pitch]);

  const stop = useCallback(() => { try { synth && synth.cancel(); } catch {} }, [synth]);
  return { supported: !!synth, voicesReady, speak, stop };
}

// ================== Heatmap Layer ==================
function HeatmapLayer({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points || points.length === 0) return;
    const clean = points.filter(p => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]));
    if (clean.length === 0) return;
    const layer = L.heatLayer(clean, { radius: 28, blur: 18, maxZoom: 15, minOpacity: 0.3 }).addTo(map);
    return () => { try { map.removeLayer(layer); } catch {} };
  }, [points, map]);
  return null;
}

// ================== Doble clic inicio/fin ==================
function MapClickHandler({ onSetStart, onSetEnd }) {
  const stateRef = useRef(0);
  useMapEvent("dblclick", (e) => {
    if (stateRef.current === 0) {
      onSetStart([e.latlng.lat, e.latlng.lng]);
      stateRef.current = 1;
    } else {
      onSetEnd([e.latlng.lat, e.latlng.lng]);
      stateRef.current = 0;
    }
  });
  return null;
}

// ================== Routing (preview / activo) ==================
function GenericRoutingMachine({
  start,
  end,
  mode,
  onRoute,
  onInstructions,
  speakEnabled = false,
  fitSelected = true,
  isPreview = false,
}) {
  const map = useMap();
  const controlRef = useRef(null);

  const traducirPaso = (ins) => {
    const m = (ins?.modifier || "").toLowerCase();
    const t = (ins?.type || "").toLowerCase();
    const via = ins?.road ? ` por ${ins.road}` : "";
    const salida = ins?.exit ? ` por la salida ${ins.exit}` : "";
    const giros = {
      straight: "Sigue recto",
      "slight right": "Gira levemente a la derecha",
      right: "Gira a la derecha",
      "sharp right": "Gira fuerte a la derecha",
      uturn: "Haz un giro en U",
      "sharp left": "Gira fuerte a la izquierda",
      left: "Gira a la izquierda",
      "slight left": "Gira levemente a la izquierda",
    };
    switch (t) {
      case "depart": return `Inicia la ruta${via}.`;
      case "continue": return (giros[m] || "Continúa") + via + ".";
      case "turn": return (giros[m] || "Gira") + via + ".";
      case "new name": return `Continúa${via}.`;
      case "end of road": return (giros[m] || "Gira") + " al final de la vía" + via + ".";
      case "on ramp": return m.includes("left") ? `Toma la rampa a la izquierda${via}.` : m.includes("right") ? `Toma la rampa a la derecha${via}.` : `Toma la rampa${via}.`;
      case "off ramp": return m.includes("left") ? `Sal por la rampa a la izquierda${via}.` : m.includes("right") ? `Sal por la rampa a la derecha${via}.` : `Toma la salida${via}.`;
      case "fork": return m.includes("left") ? `Mantente a la izquierda${via}.` : m.includes("right") ? `Mantente a la derecha${via}.` : `Mantente en la vía principal${via}.`;
      case "merge": return `Incórporate${via}.`;
      case "roundabout":
      case "rotary": return `En la glorieta${salida}${via}.`;
      case "roundabout turn": return (giros[m] || "Gira") + " en la glorieta" + via + ".";
      case "arrive":
      case "destination reached": return "Has llegado al destino.";
      case "waypoint reached": return "Punto intermedio alcanzado.";
      default: return `Continúa${via}.`;
    }
  };

  const speak = (text) => {
    try {
      if (!speakEnabled || !("speechSynthesis" in window) || !text) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "es-ES"; u.rate = 1;
      window.speechSynthesis.speak(u);
    } catch {}
  };

  useEffect(() => {
    if (!start || !end) return;

    if (controlRef.current) {
      try {
        controlRef.current.setWaypoints([L.latLng(start[0], start[1]), L.latLng(end[0], end[1])]);
        return;
      } catch {
        try { map.removeControl(controlRef.current); } catch {}
        controlRef.current = null;
      }
    }

    const router = L.Routing.osrmv1({
      serviceUrl: "https://router.project-osrm.org/route/v1/",
      profile: mode === "walk" ? "foot" : "car",
    });

    const previewStyles = [
      { color: "rgba(34,211,238,0.25)", weight: 12, opacity: 1 },
      { color: "#22d3ee", weight: 7, opacity: 1 },
      { color: "#a78bfa", weight: 3, opacity: 1, dashArray: "8,8" }
    ];

    const activeStyles = mode === "walk"
      ? [{ color: "#f59e0b", weight: 7, opacity: 0.95, dashArray: "8,8" }]
      : [{ color: "#14b8a6", weight: 7, opacity: 0.95 }];

    const rc = L.Routing.control({
      waypoints: [L.latLng(start[0], start[1]), L.latLng(end[0], end[1])],
      router,
      showAlternatives: false,
      routeWhileDragging: false,
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoute: !!fitSelected,
      createMarker: (i, wp) => L.marker(wp.latLng, { riseOnHover: true }),
      lineOptions: { styles: isPreview ? previewStyles : activeStyles },
      show: false,
    })
      .on("routesfound", (e) => {
        const r = e.routes?.[0]; if (!r) return;
        const coords = (r.coordinates || []).map(c => ({ lat: c.lat, lng: c.lng }));
        const distance = r.summary?.totalDistance || 0;

        // Tiempo estimado simple por modo
        const speed_m_s = mode === "walk" ? 1.3889 : 11.1111;
        const time = Math.round(distance / speed_m_s);

        const raw = r.instructions || [];
        const steps = (raw || []).map((ins, idx) => ({
          text: traducirPaso(ins),
          distance: ins.distance, time: ins.time, i: idx,
          latLng: r.coordinates?.[ins.index]
            ? { lat: r.coordinates[ins.index].lat, lng: r.coordinates[ins.index].lng }
            : null,
        }));
        const msgs = steps.map((s, i) => ({ id: i, raw: s, human: s.text }));

        onRoute && onRoute({ coords, distance, time, summary: r.summary, instructions: steps });
        onInstructions && onInstructions(msgs);

        if (!isPreview && msgs.length > 0) speak(`Ruta lista. ${msgs[0].human}`);
      })
      .on("routingerror", () => {
        onInstructions && onInstructions([{ id: 0, human: "No se pudo calcular la ruta (OSRM)." }]);
      })
      .addTo(map);

    controlRef.current = rc;
    return () => {
      if (controlRef.current) { try { map.removeControl(controlRef.current); } catch {} controlRef.current = null; }
    };
  }, [start, end, mode, map, onRoute, onInstructions, speakEnabled, isPreview, fitSelected]);

  return null;
}

// ================== Componente principal ==================
export default function App() {
  // datos
  const [events, setEvents] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // --------- filtros (simplificado: SOLO localidad) ---------
  const [localidadText, setLocalidadText] = useState("");

  // routing / ui
  const [startLoc, setStartLoc] = useState(null);
  const [endLoc, setEndLoc] = useState(null);
  const [mode, setMode] = useState("car");

  // Vista previa vs ruta activa
  const [previewRoute, setPreviewRoute] = useState(null);
  const [previewInstructions, setPreviewInstructions] = useState([]);
  const [isStarted, setIsStarted] = useState(false);

  // Riesgo PREVIEW
  const [previewRiskComments, setPreviewRiskComments] = useState([]);
  const [previewRiskLevel, setPreviewRiskLevel] = useState("—");

  // Ruta ACTIVA
  const [route, setRoute] = useState(null);
  const [instructions, setInstructions] = useState([]);
  const [activeInstructionIndex, setActiveInstructionIndex] = useState(0);

  // Riesgo ACTIVO
  const [riskComments, setRiskComments] = useState([]);
  const [riskLevel, setRiskLevel] = useState("—");

  const [followPosition, setFollowPosition] = useState(false);
  const [proximityMeters, setProximityMeters] = useState(300);
  const [showInstructions, setShowInstructions] = useState(true);
  const watchRef = useRef(null);
  const mapRef = useRef(null);

  // Sidebar toggle (cerrado por defecto)
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // voz
  const { supported: voiceSupported, voicesReady, speak, stop } = useVoice("es-CO", 1, 1);

  // ======= Fix 100vh móviles =======
  useEffect(() => {
    const setVh = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    setVh();
    const onResize = () => setTimeout(setVh, 100);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ======= Cargar delitos =======
  useEffect(() => {
    const load = async () => {
      setLoading(true); setLoadError(null);
      try {
        let res = await api.get("/api/delitos/markers");
        let data = Array.isArray(res.data) ? res.data : [];
        if (data.length && data[0]?.position) {
          data = data.map((d, idx) => ({
            id: d.id ?? idx,
            lat: Number(d.position?.[0]),
            lon: Number(d.position?.[1]),
            type: (d.tipo ?? d.type ?? "desconocido") + "",
            barrio: d.nombre_localidad ?? d.barrio ?? "",
            mes: d.mes ?? "",
            anios: {
              a2018: d.anio_2018, a2019: d.anio_2019, a2020: d.anio_2020, a2021: d.anio_2021,
              a2022: d.anio_2022, a2023: d.anio_2023, a2024: d.anio_2024, a2025: d.anio_2025,
            },
            variacion_porcentaje: d.variacion_porcentaje ?? null,
            total_bogota: d.total_bogota ?? null,
          }));
        } else {
          data = data.map((d, idx) => ({
            id: d.id ?? idx,
            lat: Number(d.lat ?? d.latitude),
            lon: Number(d.lng ?? d.lon ?? d.longitude),
            type: (d.tipo ?? d.type ?? "desconocido") + "",
            barrio: d.nombre_localidad ?? d.barrio ?? "",
            mes: d.mes ?? "",
            anios: {
              a2018: d.anio_2018, a2019: d.anio_2019, a2020: d.anio_2020, a2021: d.anio_2021,
              a2022: d.anio_2022, a2023: d.anio_2023, a2024: d.anio_2024, a2025: d.anio_2025,
            },
            variacion_porcentaje: d.variacion_porcentaje ?? null,
            total_bogota: d.total_bogota ?? null,
          }));
        }
        const valid = data.filter(e => Number.isFinite(e.lat) && Number.isFinite(e.lon));
        setEvents(valid); setFiltered(valid);
      } catch (e1) {
        try {
          const res2 = await api.get("/api/delitos");
          const data2 = (Array.isArray(res2.data) ? res2.data : []).map((d, idx) => ({
            id: d.id ?? d.codigo_localidad ?? idx,
            lat: Number(d.lat ?? d.latitude),
            lon: Number(d.lng ?? d.lon ?? d.longitude),
            type: (d.tipo ?? d.type ?? "desconocido") + "",
            barrio: d.nombre_localidad ?? d.barrio ?? "",
            mes: d.mes ?? "",
            anios: {
              a2018: d.anio_2018, a2019: d.anio_2019, a2020: d.anio_2020, a2021: d.anio_2021,
              a2022: d.anio_2022, a2023: d.anio_2023, a2024: d.anio_2024, a2025: d.anio_2025,
            },
            variacion_porcentaje: d.variacion_porcentaje ?? null,
            total_bogota: d.total_bogota ?? null,
          }));
          const valid2 = data2.filter(e => Number.isFinite(e.lat) && Number.isFinite(e.lon));
          setEvents(valid2); setFiltered(valid2);
        } catch (e2) {
          console.error("Error cargando delitos:", e2);
          setEvents([]); setFiltered([]);
          setLoadError("No se pudieron cargar los datos.");
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ======= Heatmap memo =======
  const heatPoints = useMemo(
    () => filtered
      .filter(ev => Number.isFinite(ev.lat) && Number.isFinite(ev.lon))
      .map(ev => [ev.lat, ev.lon, 0.7]),
    [filtered]
  );

  // ======= Filtros reactivos: SOLO Localidad =======
  useEffect(() => {
    let tmp = [...events];
    if (localidadText) {
      const s = localidadText.toLowerCase();
      tmp = tmp.filter((e) => (e.barrio || "").toLowerCase().includes(s));
    }
    setFiltered(tmp);
  }, [events, localidadText]);

  // ======= Riesgo PREVIEW =======
  useEffect(() => {
    if (!previewRoute?.coords?.length) { setPreviewRiskComments([]); setPreviewRiskLevel("—"); return; }
    const coords = previewRoute.coords;
    const sampleStep = Math.max(1, Math.floor(coords.length / 800));
    let nearest = null;
    for (const ev of filtered) {
      let minDist = Infinity;
      for (let i = 0; i < coords.length; i += sampleStep) {
        const p = coords[i];
        const d = haversineDistanceMeters(p.lat, p.lng, ev.lat, ev.lon);
        if (d < minDist) minDist = d;
        if (minDist <= 0) break;
      }
      if (minDist <= proximityMeters) {
        if (!nearest || minDist < nearest.dist) nearest = { ev, dist: Math.round(minDist) };
      }
    }
    if (!nearest) {
      setPreviewRiskComments([{ text: "🟢 Sin eventos cercanos (riesgo bajo)", ev: null, dist: null }]);
      setPreviewRiskLevel("Bajo ✅");
    } else {
      const d = nearest.dist;
      let level = "Bajo ✅", badge = "🟢";
      if (d < 100) { level = "Alto 🔴"; badge = "🔴"; }
      else if (d >= 100 && d <= 300) { level = "Medio 🟡"; badge = "🟡"; }
      const text = `${badge} ${nearest.ev.type} a ${formatDistance(d)} de la ruta (${level.toLowerCase()}) — ${nearest.ev.barrio || "zona desconocida"}`;
      setPreviewRiskComments([{ text, ev: nearest.ev, dist: d }]);
      setPreviewRiskLevel(level);
    }

    // consulta al modelo (preview)
    try {
      const step = Math.max(1, Math.floor((previewRoute.coords?.length || 1) / 200));
      const pts = (previewRoute.coords || []).filter((_, i) => i % step === 0).map(p => [p.lat, p.lng]);
      api.post("/api/predict_route_risk", { points: pts })
        .then(({ data }) => {
          if (data?.nivel_riesgo) {
            setPreviewRiskComments(prev => [
              { text: `🧠 Modelo: riesgo ${data.nivel_riesgo} (score ${data.puntuacion})` },
              ...(prev || []),
            ].slice(0, 2));
          }
        })
        .catch(() => {});
    } catch {}
  }, [previewRoute, filtered, proximityMeters]);

  // ======= Riesgo ACTIVO =======
  useEffect(() => {
    if (!route?.coords?.length) { setRiskComments([]); setRiskLevel("—"); return; }
    const coords = route.coords;
    const sampleStep = Math.max(1, Math.floor(coords.length / 800));
    let nearest = null;
    for (const ev of filtered) {
      let minDist = Infinity;
      for (let i = 0; i < coords.length; i += sampleStep) {
        const p = coords[i];
        const d = haversineDistanceMeters(p.lat, p.lng, ev.lat, ev.lon);
        if (d < minDist) minDist = d;
        if (minDist <= 0) break;
      }
      if (minDist <= proximityMeters) {
        if (!nearest || minDist < nearest.dist) nearest = { ev, dist: Math.round(minDist) };
      }
    }
    if (!nearest) {
      setRiskComments([{ text: "🟢 Sin eventos cercanos (riesgo bajo)", ev: null, dist: null }]);
      setRiskLevel("Bajo ✅");
    } else {
      const d = nearest.dist;
      let level = "Bajo ✅", badge = "🟢";
      if (d < 100) { level = "Alto 🔴"; badge = "🔴"; }
      else if (d >= 100 && d <= 300) { level = "Medio 🟡"; badge = "🟡"; }
      const text = `${badge} ${nearest.ev.type} a ${formatDistance(d)} de tu ruta (${level.toLowerCase()}) — ${nearest.ev.barrio || "zona desconocida"}`;
      setRiskComments([{ text, ev: nearest.ev, dist: d }]);
      setRiskLevel(level);
    }
  }, [route, filtered, proximityMeters]);

  // ======= Progresión instrucción por posición =======
  const updateActiveInstructionByPosition = useCallback((pos) => {
    if (!route?.coords?.length || !instructions.length) return;
    let minD = Infinity, minIdx = 0;
    for (let i = 0; i < route.coords.length; i += Math.max(1, Math.floor(route.coords.length / 1000))) {
      const p = route.coords[i];
      const d = haversineDistanceMeters(pos[0], pos[1], p.lat, p.lng);
      if (d < minD) { minD = d; minIdx = i; }
    }
    const frac = minIdx / Math.max(1, route.coords.length - 1);
    const newIdx = Math.min(instructions.length - 1, Math.max(0, Math.round(frac * (instructions.length - 1))));
    setActiveInstructionIndex(newIdx);
  }, [route, instructions]);

  // ======= Geolocalización seguir =======
  const toggleFollow = () => {
    if (!isStarted) {
      alert("Primero inicia la ruta para seguir tu ubicación.");
      return;
    }
    if (!followPosition) {
      if (!("geolocation" in navigator)) { alert("Tu navegador no soporta geolocalización."); return; }
      const id = navigator.geolocation.watchPosition((pos) => {
        const coords = [pos.coords.latitude, pos.coords.longitude];
        if (mapRef.current) { try { mapRef.current.setView(coords, 16, { animate: true }); } catch {} }
        updateActiveInstructionByPosition(coords);
      }, (err) => { console.warn("watch error", err); }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 });
      watchRef.current = id;
      setFollowPosition(true);
    } else {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
      setFollowPosition(false);
    }
  };

  // ======= Cuando llega la RUTA ACTIVA =======
  const onRouteActive = useCallback((r) => {
    setRoute(r);
    setActiveInstructionIndex(0);
    try {
      const step = Math.max(1, Math.floor((r.coords?.length || 1) / 200));
      const pts = (r.coords || []).filter((_, i) => i % step === 0).map(p => [p.lat, p.lng]);
      api.post("/api/predict_route_risk", { points: pts })
        .then(({ data }) => {
          if (data?.nivel_riesgo) {
            setRiskComments(prev => [
              { text: `🧠 Modelo: riesgo ${data.nivel_riesgo} (score ${data.puntuacion})` },
              ...(prev || []),
            ].slice(0, 2));
          }
        })
        .catch(() => {});
    } catch {}
  }, []);

  // ======= Instrucciones ACTIVAS =======
  const onInstructionsActive = useCallback((msgs) => {
    setInstructions(msgs || []);
    setActiveInstructionIndex(0);
    try {
      if (msgs && msgs.length && voicesReady && showInstructions && voiceSupported) {
        const first = msgs[0]?.human || "Sigue las indicaciones.";
        speak(`Ruta lista. ${first}`);
      }
    } catch {}
  }, [voicesReady, speak, showInstructions, voiceSupported]);

  // ======= Preview handlers =======
  const onRoutePreview = useCallback((r) => { setPreviewRoute(r); }, []);
  const onInstructionsPreview = useCallback((msgs) => { setPreviewInstructions(msgs || []); }, []);

  // ======= Limpiar =======
  const clearRoute = () => {
    try { stop(); } catch {}
    setPreviewRoute(null);
    setPreviewInstructions([]);
    setPreviewRiskComments([]);
    setPreviewRiskLevel("—");
    setIsStarted(false);

    setRoute(null);
    setInstructions([]);
    setActiveInstructionIndex(0);
    setRiskComments([]);
    setRiskLevel("—");
    setEndLoc(null);
    setFollowPosition(false);
    if (watchRef.current != null) { try { navigator.geolocation.clearWatch(watchRef.current); } catch {} }
    watchRef.current = null;
  };

  // ======= Reset a preview cuando cambian start/end/mode =======
  useEffect(() => {
    setIsStarted(false);
    setRoute(null);
    setInstructions([]);
    setActiveInstructionIndex(0);
    setRiskComments([]);
    setRiskLevel("—");
  }, [startLoc?.[0], startLoc?.[1], endLoc?.[0], endLoc?.[1], mode]);

  // ======= Center on start changes =======
  useEffect(() => {
    if (startLoc && mapRef.current) {
      try { mapRef.current.setView(startLoc, 14, { animate: true }); } catch {}
    }
  }, [startLoc]);

  // ======= Helpers UI =======
  const riskLevelToPulse = (lvl) => {
    if ((lvl || "").includes("Alto")) return "pulse-high";
    if ((lvl || "").includes("Medio")) return "pulse-medium";
    if ((lvl || "").includes("Bajo")) return "pulse-low";
    return "";
  };
  const riskLevelClass = (lvl) => {
    if ((lvl || "").includes("Alto")) return "panel-alert-high";
    if ((lvl || "").includes("Medio")) return "panel-alert-medium";
    if ((lvl || "").includes("Bajo")) return "panel-alert-low";
    return "";
  };
  const riskLabel = (lvl) => {
    if ((lvl || "").includes("Alto")) return "ALTO";
    if ((lvl || "").includes("Medio")) return "MEDIO";
    if ((lvl || "").includes("Bajo")) return "BAJO";
    return "—";
  };
  const modeLabel = (m) => (m === "walk" ? "Caminando" : "Vehículo");
  const levelKeyFromLabel = (lbl) =>
    lbl === "ALTO" ? "high" : lbl === "MEDIO" ? "medium" : "low";
  const riskAdvice = (lvl, currentMode) => {
    if ((lvl || "").includes("Alto")) {
      return currentMode === "walk"
        ? "Evita calles poco iluminadas o solas. Mantente en avenidas principales, comparte tu ubicación y considera una ruta alternativa."
        : "Prefiere vías principales e iluminadas. Evita detenerte; puertas y ventanas aseguradas. Considera una ruta alternativa.";
    }
    if ((lvl || "").includes("Medio")) {
      return currentMode === "walk"
        ? "Mantén atención al entorno y tus pertenencias. Evita atajos y zonas estrechas."
        : "Conduce con precaución y evita calles estrechas. No te detengas innecesariamente.";
    }
    return currentMode === "walk"
      ? "Ruta recomendable. Aun así, mantén atención al entorno."
      : "Ruta recomendable. Conduce atento y respeta señales.";
  };

  // ======= Beep cuando el nivel pasa a ALTO =======
  const lastAlertRef = useRef(false);
  const playBeep = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880; // tono agudo
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
      o.connect(g); g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.27);
      o.onended = () => ctx.close();
    } catch {}
  }, []);

  useEffect(() => {
    const lvl = isStarted ? riskLevel : previewRiskLevel;
    const isHigh = (lvl || "").includes("Alto");
    if (isHigh && !lastAlertRef.current) {
      playBeep();
      lastAlertRef.current = true;
    } else if (!isHigh) {
      lastAlertRef.current = false;
    }
  }, [isStarted, riskLevel, previewRiskLevel, playBeep]);

  // ======= ancho real sidebar (para mover el bottomPanel) =======
  const [sidebarWidth, setSidebarWidth] = useState(getSidebarWidth());
  useEffect(() => {
    const onResize = () => setSidebarWidth(getSidebarWidth());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const bottomPanelLeft = sidebarOpen ? sidebarWidth + 24 : 12;

  // ======= Render =======
  return (
    <div style={styles.app}>
      {/* CSS global */}
      <style>{`
        html, body, #root { height: 100%; width: 100%; margin: 0; padding: 0; }
        body { overscroll-behavior: none; background: #0b1224; }
        .leaflet-container { height: 100%; width: 100%; }
        @supports (height: 100svh) { :root { --vh: 1svh; } }

        .badge {
          display:inline-flex; align-items:center; gap:6px;
          font-size:12px; padding:4px 8px; border-radius:9999px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .btn-primary { background:#2563eb; color:#fff; border: none; }
        .btn-plain { background:transparent; color:#9fb4c9; border:1px solid rgba(255,255,255,0.08); }
        .card {
          background:#041021; border-radius:12px; padding:12px;
          border:1px solid rgba(255,255,255,0.06);
        }

        /* Hamburguesa */
        .hamb-line { display:block; width:26px; height:3px; background:#ffffff; margin:5px 0; border-radius:2px; }
        button.hamb:focus-visible { outline: 3px solid #93c5fd; outline-offset: 2px; }
        button.hamb:hover { transform: translateY(-1px); box-shadow: 0 10px 28px rgba(0,0,0,0.7); background: rgba(5,16,36,0.95); }

        /* Pulso (borde/sombra) */
        @keyframes pulseHigh {
          0% { box-shadow: 0 0 0 rgba(239,68,68,0.0); }
          50% { box-shadow: 0 0 38px rgba(239,68,68,0.6); }
          100% { box-shadow: 0 0 0 rgba(239,68,68,0.0); }
        }
        @keyframes pulseMedium {
          0% { box-shadow: 0 0 0 rgba(245,158,11,0.0); }
          50% { box-shadow: 0 0 30px rgba(245,158,11,0.55); }
          100% { box-shadow: 0 0 0 rgba(245,158,11,0.0); }
        }
        @keyframes pulseLow {
          0% { box-shadow: 0 0 0 rgba(16,185,129,0.0); }
          50% { box-shadow: 0 0 22px rgba(16,185,129,0.45); }
          100% { box-shadow: 0 0 0 rgba(16,185,129,0.0); }
        }
        .pulse-high { animation: pulseHigh 1s infinite; border-color: rgba(239,68,68,0.6) !important; }
        .pulse-medium { animation: pulseMedium 1.2s infinite; border-color: rgba(245,158,11,0.6) !important; }
        .pulse-low { animation: pulseLow 1.4s infinite; border-color: rgba(16,185,129,0.6) !important; }

        /* Fondo del panel que también titila */
        .panel-friendly { position: relative; align-items: stretch; overflow: hidden; }
        .panel-friendly::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0;
          transition: opacity .2s ease;
        }
        @keyframes bgPulseHigh { 0%{opacity:0;} 50%{opacity:.45;} 100%{opacity:0;} }
        @keyframes bgPulseMedium { 0%{opacity:0;} 50%{opacity:.35;} 100%{opacity:0;} }
        @keyframes bgPulseLow { 0%{opacity:0;} 50%{opacity:.25;} 100%{opacity:0;} }

        .panel-alert-high { background: linear-gradient(180deg, rgba(38,9,9,0.9), rgba(22,6,6,0.95)); }
        .panel-alert-medium { background: linear-gradient(180deg, rgba(38,28,8,0.9), rgba(24,17,6,0.95)); }
        .panel-alert-low { background: linear-gradient(180deg, rgba(7,28,22,0.9), rgba(5,20,16,0.95)); }

        .panel-alert-high.panel-friendly::before { background: rgba(239,68,68,0.55); animation: bgPulseHigh 1s infinite; }
        .panel-alert-medium.panel-friendly::before { background: rgba(245,158,11,0.45); animation: bgPulseMedium 1.2s infinite; }
        .panel-alert-low.panel-friendly::before { background: rgba(16,185,129,0.35); animation: bgPulseLow 1.4s infinite; }

        .row { display:flex; gap:8px; flex-wrap:wrap; }
        .chip { display:inline-flex; align-items:center; gap:8px; padding:6px 10px; border-radius:9999px; background: rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.08); font-size:12px; }
        .chip.level { font-weight:800; }
        .dot { width:10px; height:10px; border-radius:9999px; display:inline-block; }
        .dot.high{ background:#ef4444; } .dot.medium{ background:#f59e0b; } .dot.low{ background:#10b981; }
        .advice { margin-top:10px; font-size:15px; line-height:1.35; color:#e9f2ff; font-weight:700; }
        .panel-right {
          min-width:200px; text-align:right; padding-left:12px; border-left:1px solid rgba(255,255,255,.06);
          display:flex; gap:14px; align-items:center; justify-content:flex-end; flex-wrap:wrap;
        }
        .metric .label { font-size:12px; color:#9fb4c9; }
        .metric .value { margin-top:4px; font-weight:800; }
        @media (max-width: 560px) {
          .panel-right { min-width:auto; border-left:none; text-align:left; justify-content:flex-start; }
        }
      `}</style>

      {/* Botón hamburguesa */}
      <button
        aria-label={sidebarOpen ? "Ocultar panel" : "Mostrar panel"}
        aria-controls="sidepanel"
        title={sidebarOpen ? "Ocultar panel" : "Mostrar panel"}
        className="hamb"
        style={styles.hamburger}
        onClick={() => setSidebarOpen((s) => !s)}
      >
        <span className="hamb-line" />
        <span className="hamb-line" />
        <span className="hamb-line" />
      </button>

      {/* Sidebar */}
      <aside
        id="sidepanel"
        style={{
          ...styles.sidebar,
          width: sidebarWidth,
          ...(sidebarOpen ? styles.sidebarOpen : null),
        }}
      >
        <div>
          <div style={styles.title}>🧭 Mapa de Riesgo Pro</div>
          <div style={styles.small}>Ruta + filtro por localidad</div>
          {loading && <div style={{ color: "#9fb4c9", fontSize: 12, marginTop: 6 }}>Cargando datos…</div>}
          {loadError && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 6 }}>{loadError}</div>}
        </div>

        {/* Controles de Ruta */}
        <div className="card" style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Ruta</div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ color: "#9fb4c9", fontSize: 13 }}>Inicio</label>
            <SearchBox onSelectLocation={(coords) => setStartLoc(coords)} placeholder="Buscar inicio..." />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ color: "#9fb4c9", fontSize: 13 }}>Destino</label>
            <SearchBox onSelectLocation={(coords) => setEndLoc(coords)} placeholder="Buscar destino..." />
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              style={{ flex: 1, padding: 8, borderRadius: 10, background: "#061226", color: "#e6eef8", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <option value="car">🚗 Vehículo</option>
              <option value="walk">🚶‍♂️ Caminando</option>
            </select>

            <button
              className="btn-primary"
              style={{ padding: "8px 10px", borderRadius: 10 }}
              onClick={() => {
                if (!previewRoute) return alert("Traza primero una ruta (elige inicio y destino).");
                setIsStarted(true);
                setRoute(null);
                setInstructions([]);
                setActiveInstructionIndex(0);
                if (followPosition) { try { navigator.geolocation.clearWatch(watchRef.current); } catch {} setFollowPosition(false); }
              }}
            >
              Iniciar
            </button>

            <button className="btn-plain" style={{ padding: "8px 10px", borderRadius: 10 }} onClick={clearRoute}>
              Limpiar
            </button>
          </div>

          <div style={{ marginTop: 10 }}>
            <label style={{ color: "#9fb4c9", fontSize: 13 }}>
              Radio proximidad: <strong>{proximityMeters} m</strong>
            </label>
            <input
              type="range" min={50} max={2500} step={10}
              value={proximityMeters}
              onChange={(e) => setProximityMeters(Number(e.target.value))}
              style={{ width: "100%", marginTop: 6 }}
            />
          </div>

          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#9fb4c9" }}>
              <input
                type="checkbox"
                checked={showInstructions}
                onChange={(e) => setShowInstructions(e.target.checked)}
              />
              Voz (TTS)
            </label>
            <div style={{ marginLeft: "auto", color: "#86a6bf", fontSize: 12 }}>
              {isStarted && route ? `${formatDistance(route.distance)} • ${formatTimeMin(route.time)}` :
               previewRoute ? `Preview: ${formatDistance(previewRoute.distance)} • ${formatTimeMin(previewRoute.time)}` : "—"}
            </div>
          </div>
        </div>

        {/* Filtro ÚNICO: Localidad */}
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Filtro por Localidad</div>
          <input
            type="text"
            value={localidadText}
            onChange={(e) => setLocalidadText(e.target.value)}
            placeholder="Escribe la localidad…"
            style={{ width: "100%", padding: 8, borderRadius: 10, background: "#061226", color: "#e6eef8", border: "1px solid rgba(255,255,255,0.06)" }}
          />
          <div style={{ marginTop: 6, color: "#6b7280", fontSize: 12 }}>
            (Se aplica automáticamente)
          </div>
        </div>

        <div style={{ marginTop: 12, color: "#6b7280", fontSize: 12 }}>
          Tip: Doble clic en el mapa para marcar inicio/destino. Usa “Iniciar” para comenzar navegación y voz.
        </div>
      </aside>

      {/* Map area */}
      <div style={styles.mapWrap}>
        {/* Floating controls */}
        <div style={styles.floatingControls}>
          <button
            onClick={toggleFollow}
            style={{ ...styles.fab, background: followPosition ? "#ef4444" : "#0ea5a7", color: "#021025" }}
          >
            {followPosition ? "⏸️ Detener" : "📍 Seguir"}
          </button>
          <button
            onClick={() => {
              if (startLoc && mapRef.current) {
                try { mapRef.current.setView(startLoc, 15, { animate: true }); } catch {}
              } else if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition((p) => mapRef.current && mapRef.current.setView([p.coords.latitude, p.coords.longitude], 15));
              }
            }}
            style={{ ...styles.fab, background: "#60a5fa", color: "#021025" }}
          >
            📌 Centrar
          </button>
        </div>

        <MapContainer
          center={[4.60971, -74.08175]}
          zoom={12}
          style={{ height: "100%", width: "100%" }}
          doubleClickZoom={false}
          whenCreated={(m) => {
            mapRef.current = m;
            requestAnimationFrame(() => { try { m.invalidateSize(); } catch {} });
            setTimeout(() => { try { m.invalidateSize(); } catch {} }, 250);
          }}
        >
          <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {/* Heatmap */}
          <HeatmapLayer points={heatPoints} />

          {/* Doble clic inicio/fin */}
          <MapClickHandler onSetStart={setStartLoc} onSetEnd={setEndLoc} />

          {/* Start/End markers */}
          {startLoc && <Marker position={startLoc}><Popup>Inicio</Popup></Marker>}
          {endLoc && <Marker position={endLoc}><Popup>Destino</Popup></Marker>}

          {/* PREVIEW (neón, sin voz) */}
          {startLoc && endLoc && !isStarted && (
            <GenericRoutingMachine
              start={startLoc}
              end={endLoc}
              mode={mode}
              onRoute={onRoutePreview}
              onInstructions={onInstructionsPreview}
              speakEnabled={false}
              isPreview={true}
              fitSelected={true}
            />
          )}

          {/* ACTIVA (color, voz, riesgo) */}
          {startLoc && endLoc && isStarted && (
            <GenericRoutingMachine
              start={startLoc}
              end={endLoc}
              mode={mode}
              onRoute={onRouteActive}
              onInstructions={onInstructionsActive}
              speakEnabled={showInstructions && voiceSupported}
              isPreview={false}
              fitSelected={true}
            />
          )}

          {/* Markers (cluster / simple) */}
          {MarkerClusterGroup ? (
            <MarkerClusterGroup chunkedLoading>
              {filtered.map((ev) => (
                <Marker key={ev.id} position={[ev.lat, ev.lon]}>
                  <Popup>
                    <div style={{ minWidth: 220 }}>
                      <strong>{ev.type}</strong>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>{ev.barrio}</div>
                      {ev.mes && <div style={{ fontSize: 12, marginTop: 4 }}>Periodo: {ev.mes}</div>}
                      <div style={{ fontSize: 12, marginTop: 6, lineHeight: 1.3 }}>
                        {Object.entries(ev.anios || {}).map(([k, v]) => v != null ? <div key={k}>{k.replace("a", "")}: {v}</div> : null)}
                        {ev.variacion_porcentaje != null && <div>Variación: {ev.variacion_porcentaje}%</div>}
                        {ev.total_bogota != null && <div>Total Bogotá: {ev.total_bogota}</div>}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MarkerClusterGroup>
          ) : (
            filtered.map((ev) => (
              <Marker key={ev.id} position={[ev.lat, ev.lon]}>
                <Popup>
                  <div style={{ minWidth: 220 }}>
                    <strong>{ev.type}</strong>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{ev.barrio}</div>
                    {ev.mes && <div style={{ fontSize: 12, marginTop: 4 }}>Periodo: {ev.mes}</div>}
                    <div style={{ fontSize: 12, marginTop: 6, lineHeight: 1.3 }}>
                      {Object.entries(ev.anios || {}).map(([k, v]) => v != null ? <div key={k}>{k.replace("a", "")}: {v}</div> : null)}
                      {ev.variacion_porcentaje != null && <div>Variación: {ev.variacion_porcentaje}%</div>}
                      {ev.total_bogota != null && <div>Total Bogotá: {ev.total_bogota}</div>}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))
          )}

          {/* Puntos cercanos a la RUTA ACTIVA */}
          {isStarted && route && filtered.length > 0 && (() => {
            const nearPoints = [];
            const sampleStep = Math.max(1, Math.floor(route.coords.length / 800));
            for (let i = 0; i < route.coords.length; i += sampleStep) {
              const p = route.coords[i];
              for (const ev of filtered) {
                const d = haversineDistanceMeters(p.lat, p.lng, ev.lat, ev.lon);
                if (d <= proximityMeters) { nearPoints.push({ lat: p.lat, lng: p.lng, dist: Math.round(d), ev }); break; }
              }
            }
            return nearPoints.slice(0, 60).map((p, idx) => (
              <CircleMarker
                key={`near-${idx}`} center={[p.lat, p.lng]} radius={6}
                pathOptions={{ color: p.dist < 100 ? "#ef4444" : p.dist <= 300 ? "#f59e0b" : "#10b981", weight: 2, opacity: 0.95 }}
              >
                <Popup>{`${p.ev.type} a ${formatDistance(p.dist)}`}</Popup>
              </CircleMarker>
            ));
          })()}

        </MapContainer>

        {/* Panel inferior (titila + info + consejo) */}
        {(previewRoute || route) && (
          (() => {
            const isActive = isStarted;
            const lvl = isActive ? riskLevel : previewRiskLevel;
            const clsPulse = riskLevelToPulse(lvl);
            const clsPanel = riskLevelClass(lvl);
            const lbl = riskLabel(lvl);
            const levelKey = (lbl === "ALTO" ? "high" : lbl === "MEDIO" ? "medium" : "low");

            const data = isActive ? route : previewRoute;
            const dist = data ? formatDistance(data.distance) : "—";
            const tim = data ? formatTimeMin(data.time) : "—";
            const stepsCount = isActive ? (instructions?.length || 0) : (previewInstructions?.length || 0);

            return (
              <div
                style={{ ...styles.bottomPanel, left: bottomPanelLeft }}
                className={`${clsPulse} ${clsPanel} panel-friendly`}
                role="status"
                aria-live="polite"
              >
                <div style={{ ...styles.bottomLeft }}>
                  <div className="row">
                    <span className="chip">{isActive ? "🧭 Navegación activa" : "👀 Vista previa"}</span>
                    <span className="chip">{modeLabel(mode)} {mode === "walk" ? "🚶" : "🚗"}</span>
                    <span className="chip level"><span className={`dot ${levelKey}`} /> Nivel {lbl}</span>
                  </div>
                  <div className="advice">
                    {riskAdvice(lvl, mode)}
                  </div>
                </div>

                <div className="panel-right">
                  <div className="metric">
                    <div className="label">Distancia</div>
                    <div className="value">{dist}</div>
                  </div>
                  <div className="metric">
                    <div className="label">Tiempo</div>
                    <div className="value">{tim}</div>
                  </div>
                  <div className="metric">
                    <div className="label">Pasos</div>
                    <div className="value">{stepsCount}</div>
                  </div>
                </div>
              </div>
            );
          })()
        )}

      </div>
    </div>
  );
}
