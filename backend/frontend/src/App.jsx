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
  ZoomControl,
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

// ⭐ Icono morado para PARADA
const viaIcon = L.divIcon({
  className: "via-icon",
  html: `<div style="
    width:24px;height:24px;border-radius:50%;
    background:#a78bfa;border:2px solid #fff;
    box-shadow:0 2px 10px rgba(0,0,0,.35);
  "></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
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

// ===== helpers de storage (no rompe si está bloqueado) =====
const getLS = (k, fallback = null) => {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};
const setLS = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
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
    touchAction: "pan-x pan-y",
  },

  /* ===== SPLASH (solo visual) ===== */
  splash: {
    position: "fixed",
    inset: 0,
    zIndex: 99999,
    display: "grid",
    placeItems: "center",
    background: "#050b18",
    color: "#e6eef8",
    pointerEvents: "none",
    overflow: "hidden",
  },
  splashCenter: { textAlign: "center", padding: "28px 24px", position: "relative" },
  splashTitle: {
    fontSize: "clamp(56px, 12vw, 160px)",
    fontWeight: 1000,
    letterSpacing: 0.6,
    marginBottom: 12,
    lineHeight: 1,
    background:
      "linear-gradient(90deg, #9fc5ff 0%, #5bd5ff 25%, #a48bff 60%, #9fc5ff 100%)",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
    textShadow: "0 4px 30px rgba(96,165,250,0.15)",
  },
  splashSubtitle: { fontSize: "clamp(13px, 2.8vw, 18px)", color: "#a7bed2", marginBottom: 18 },
  splashLoaderTrack: {
    width: "min(420px, 80vw)",
    height: 3,
    borderRadius: 9999,
    background: "rgba(255,255,255,0.10)",
    margin: "10px auto 0",
    overflow: "hidden",
  },
  splashLoaderBar: {
    width: "38%",
    height: "100%",
    borderRadius: 9999,
    background: "linear-gradient(90deg,#9fc5ff,#5bd5ff,#a48bff)",
    animation: "barSlide 1.6s ease-in-out infinite",
  },
  jjssWrap: {
    marginTop: 18,
    display: "inline-flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
    borderRadius: 9999,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35), inset 0 0 30px rgba(99,102,241,0.08)",
    backdropFilter: "blur(10px)",
  },
  jjssMonogram: {
    display: "inline-flex",
    gap: 6,
    fontWeight: 900,
    letterSpacing: 1,
    fontSize: "clamp(18px, 3.2vw, 28px)",
    lineHeight: 1,
  },

  /* ===== SIDEBAR / MAP UI ===== */
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
    padding: "calc(env(safe-area-inset-top, 0px) + 56px) 16px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    boxShadow: "2px 0 24px rgba(0,0,0,0.5)",
    zIndex: 4000,
    borderRight: "1px solid rgba(255,255,255,0.08)",
    transform: "translateX(-110%)",
    transition: "transform .3s ease, opacity .3s ease",
    opacity: 0,
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
  },
  sidebarOpen: { transform: "translateX(0)", opacity: 1 },
  closeFab: {
    position: "absolute",
    right: -18,
    top: "calc(env(safe-area-inset-top, 0px) + 10px)",
    width: 40,
    height: 40,
    borderRadius: "9999px",
    border: "2px solid rgba(255,255,255,0.9)",
    background: "rgba(2,10,28,0.96)",
    color: "#e6eef8",
    cursor: "pointer",
    boxShadow: "0 10px 28px rgba(0,0,0,0.7)",
    zIndex: 4500,
    display: "grid",
    placeItems: "center",
    transition: "transform .08s ease, box-shadow .2s ease, background .2s ease",
    backdropFilter: "blur(6px)",
  },
  title: { color: "#60a5fa", fontSize: 18, fontWeight: 800, letterSpacing: 0.2 },
  small: { color: "#9fb4c9", fontSize: 12.5 },
  mapWrap: { flex: 1, position: "relative", minWidth: 0 },

  hamburger: {
    position: "absolute",
    left: 12,
    top: "calc(env(safe-area-inset-top, 0px) + 12px)",
    zIndex: 3500,
    padding: "14px 16px",
    borderRadius: 16,
    border: "2px solid rgba(255,255,255,0.9)",
    background: "rgba(2,10,28,0.9)",
    color: "#e6eef8",
    cursor: "pointer",
    boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
    outline: "none",
    transition: "transform .08s ease, box-shadow .2s ease, background .2s.ease",
    backdropFilter: "blur(6px)",
    touchAction: "manipulation",
  },

  bottomPanel: {
    position: "absolute",
    right: 12,
    bottom: 14,
    zIndex: 9999,
    background: "linear-gradient(180deg, rgba(8,10,14,0.9), rgba(4,6,12,0.97))",
    borderRadius: 14,
    padding: 12,
    boxShadow: "0 8px 34px rgba(2,6,23,0.7)",
    color: "#e6eef8",
    display: "flex",
    gap: 14,
    alignItems: "stretch",
    transition: "transform .2s ease, opacity .2s ease, left .25s.ease",
    border: "1px solid rgba(255,255,255,0.08)",
    minWidth: 320,
    maxWidth: "min(92vw, 920px)",
  },
  bottomLeft: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column" },
  instrList: {
    marginTop: 8,
    maxHeight: 220,
    overflowY: "auto",
    paddingRight: 6,
    scrollBehavior: "smooth",
    WebkitOverflowScrolling: "touch",
  },
  instrItem: {
    fontSize: 14,
    lineHeight: 1.25,
    padding: "10px 12px",
    borderRadius: 10,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    cursor: "pointer",
  },
  instrItemActive: {
    background: "rgba(96,165,250,0.16)",
    border: "1px solid rgba(96,165,250,0.55)",
    boxShadow: "0 0 0 2px rgba(96,165,250,0.25) inset",
  },
  chipTab: { cursor: "pointer", userSelect: "none" },

  // Botones flotantes
  geoBtn: {
    position: "absolute",
    top: 120,
    right: 12,
    zIndex: 3500,
    padding: "12px 14px",
    borderRadius: 16,
    border: "2px solid rgba(255,255,255,0.9)",
    background: "rgba(2,10,28,0.9)",
    color: "#e6eef8",
    cursor: "pointer",
    boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
    backdropFilter: "blur(6px)",
    touchAction: "manipulation",
  },
  viaBtn: {
    position: "absolute",
    top: 180,
    right: 8,
    zIndex: 3500,
    padding: "12px 14px",
    borderRadius: 16,
    border: "2px solid rgba(255,255,255,0.9)",
    background: "rgba(2,10,28,0.9)",
    color: "#e6eef8",
    cursor: "pointer",
    boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
    backdropFilter: "blur(6px)",
    touchAction: "manipulation",
  },

  // ====== NUEVOS ESTILOS: barra minimizada y botón ======
  miniBar: {
    position: "absolute",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(8,10,14,0.9)",
    color: "#e6eef8",
    boxShadow: "0 8px 24px rgba(2,6,23,0.7)",
  },

  miniToggleBtn: {
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(2,10,28,0.9)",
    color: "#e6eef8",
    borderRadius: 10,
    padding: "8px 10px",
    cursor: "pointer",
  },
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
const formatDistanceBOG = (m) => {
  if (!Number.isFinite(m)) return "—";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${Math.round(m / 1000)} km`;
};
const formatDurationBOG = (seconds) => {
  if (!Number.isFinite(seconds)) return "—";
  const totalMin = Math.max(0, Math.round(seconds / 60));
  if (totalMin < 60) return `${Math.max(1, totalMin)} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
};

// —— convertir metros a grados (aprox) para generar vias
const metersToDeg = (lat, dx, dy) => {
  const mPerDegLat = 111320;
  const mPerDegLon = 111320 * Math.cos(toRad(lat));
  return { dLat: dy / mPerDegLat, dLon: dx / mPerDegLon };
};

// ======= Estimación de TIEMPO “real” para Bogotá =======
function bogotaSpeedKmh(mode, now = new Date()) {
  if (mode === "walk") return 4.8;
  const h = now.getHours();
  const d = now.getDay();
  const weekend = d === 0 || d === 6;
  if (weekend) { if (h >= 11 && h < 20) return 26; return 32; }
  if ((h >= 6 && h < 9) || (h >= 16 && h < 20)) return 22;
  if (h >= 9 && h < 16) return 28;
  return 34;
}
function estimateBogotaTimeSec(distance_m, mode) {
  const v = bogotaSpeedKmh(mode);
  const metersPerSec = (v * 1000) / 3600;
  const secs = distance_m / Math.max(1e-6, metersPerSec);
  return Math.max(60, Math.round(secs));
}

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
    try { synth.cancel(); } catch {}
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang; u.rate = rate; u.pitch = pitch;
    try { synth.speak(u); } catch {}
  }, [synth, lang, rate, pitch]);

  const stop = useCallback(() => { try { synth && synth.cancel(); } catch {} }, [synth]);
  return { supported: !!synth, voicesReady, speak, stop };
}

// ================== Hook de ALERTA SONORA ==================
function useAlertAudio({ cooldownMs = 15000 } = {}) {
  const ctxRef = useRef(null);
  const unlockedRef = useRef(false);
  const lastPlayRef = useRef(0);

  useEffect(() => {
    const unlock = () => {
      if (unlockedRef.current) return;
      try {
        const ctx = ctxRef.current || new (window.AudioContext || window.webkitAudioContext)();
        ctxRef.current = ctx;
        if (ctx.state === "suspended") ctx.resume();
        unlockedRef.current = true;
      } catch {}
    };
    const evts = ["pointerdown", "keydown"];
    evts.forEach((e) => window.addEventListener(e, unlock, { once: true, passive: true }));
    return () => evts.forEach((e) => window.removeEventListener(e, unlock));
  }, []);

  const simpleBeep = useCallback(async (freq = 800, durationMs = 180, gainValue = 0.2) => {
    try {
      const ctx = ctxRef.current || new (window.AudioContext || window.webkitAudioContext)();
      ctxRef.current = ctx;
      if (ctx.state === "suspended") await ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.value = 0;

      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);

      osc.start(now);
      osc.stop(now + durationMs / 1000 + 0.02);
    } catch {}
  }, []);

  const playPattern = useCallback(async (level) => {
    const nowT = Date.now();
    if (nowT - lastPlayRef.current < cooldownMs) return;
    lastPlayRef.current = nowT;

    if (level === "ALTO") {
      await simpleBeep(880, 200, 0.35);
      await new Promise(r => setTimeout(r, 140));
      await simpleBeep(990, 200, 0.35);
      await new Promise(r => setTimeout(r, 140));
      await simpleBeep(880, 260, 0.4);
    } else if (level === "MEDIO") {
      await simpleBeep(660, 180, 0.22);
      await new Promise(r => setTimeout(r, 180));
      await simpleBeep(660, 200, 0.22);
    } else {
      // BAJO -> silencio
    }
  }, [cooldownMs, simpleBeep]);

  return { playPattern };
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

// ⭐ Colocar/actualizar PARADA con un clic cuando viaMode está activo
function MapViaSetter({ active, onSetVia }) {
  useMapEvent("click", (e) => {
    if (!active) return;
    onSetVia([e.latlng.lat, e.latlng.lng]);
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
  viaPoints = [],
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
        const wps = [L.latLng(start[0], start[1]), ...viaPoints.map(v => L.latLng(v[0], v[1])), L.latLng(end[0], end[1])];
        controlRef.current.setWaypoints(wps);
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
      { color: "rgba(34,211,238,0.28)", weight: 12, opacity: 1 },
      { color: "#22d3ee", weight: 7, opacity: 1 },
      { color: "#a78bfa", weight: 3, opacity: 1, dashArray: "8,8" }
    ];

    const activeStyles = mode === "walk"
      ? [{ color: "#f59e0b", weight: 7, opacity: 0.97, dashArray: "8,8" }]
      : [{ color: "#14b8a6", weight: 7, opacity: 0.97 }];

    const rc = L.Routing.control({
      waypoints: [L.latLng(start[0], start[1]), ...viaPoints.map(v => L.latLng(v[0], v[1])), L.latLng(end[0], end[1])],
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

        const time = estimateBogotaTimeSec(distance, mode);

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

        if (!isPreview && msgs.length > 0) speak(`iniciemos el viaje. ${msgs[0].human}`);
      })
      .on("routingerror", () => {
        onInstructions && onInstructions([{ id: 0, human: "No se pudo calcular la ruta (OSRM)." }]);
      })
      .addTo(map);

    controlRef.current = rc;
    return () => {
      if (controlRef.current) { try { map.removeControl(controlRef.current); } catch {} controlRef.current = null; }
    };
  }, [start, end, mode, map, onRoute, onInstructions, speakEnabled, isPreview, fitSelected, viaPoints]);

  return null;
}

// ================== Componente principal ==================
export default function App() {
  // Splash (duración)
  const SPLASH_MS = 4200;
  const [showSplash, setShowSplash] = useState(true);

  // ======= Responsive flag =======
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 768 : false
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // datos
  const [events, setEvents] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // filtros (debounce)
  const [localidadText, setLocalidadText] = useState("");
  const [localidadDebounced, setLocalidadDebounced] = useState("");

  // routing / ui
  const [startLoc, setStartLoc] = useState(getLS("startLoc", null));
  const [endLoc, setEndLoc] = useState(getLS("endLoc", null));
  const [mode, setMode] = useState(getLS("mode", "car"));

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

  const [proximityMeters, setProximityMeters] = useState(getLS("proximityMeters", 300));
  const [showInstructions, setShowInstructions] = useState(true);

  // 🔊 Preferencia de sonido de alerta
  const [alertSoundEnabled, setAlertSoundEnabled] = useState(getLS("alertSoundEnabled", true));

  // Panel inferior ("summary" | "instructions")
  const [bottomMode, setBottomMode] = useState("summary");

  // ⭐ NUEVO: Minimizar / Expandir panel inferior (persistente)
  const [isAlertMinimized, setIsAlertMinimized] = useState(getLS("alertMinimized", false));
  useEffect(() => { setLS("alertMinimized", isAlertMinimized); }, [isAlertMinimized]);

  // Coordenada del paso bajo hover
  const [hoveredStepLatLng, setHoveredStepLatLng] = useState(null);

  const mapRef = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(getLS("sidebarOpen", false));

  // voz
  const { supported: voiceSupported, voicesReady, speak, stop } = useVoice("es-CO", 1, 1);

  // ⭐ PARADAS (waypoints) y modo colocar
  const [viaPoints, setViaPoints] = useState([]);
  const [viaMode, setViaMode] = useState(false);

  // ======= Hook de audio de alerta =======
  const { playPattern } = useAlertAudio({ cooldownMs: 15000 });
  const lastPreviewLevelRef = useRef("—");
  const lastActiveLevelRef = useRef("—");

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

  // ======= Mostrar splash =======
  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  // ======= Cargar datos =======
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
      } catch {
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
      } finally { setLoading(false); }
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

  // ======= Debounce del filtro de localidad =======
  useEffect(() => {
    const t = setTimeout(() => setLocalidadDebounced(localidadText), 220);
    return () => clearTimeout(t);
  }, [localidadText]);

  // ======= Filtros =======
  useEffect(() => {
    let tmp = [...events];
    const s = (localidadDebounced || "").toLowerCase();
    if (s) tmp = tmp.filter((e) => (e.barrio || "").toLowerCase().includes(s));
    setFiltered(tmp);
  }, [events, localidadDebounced]);

  // ===== helpers de riesgo =====
  const computeNearestEventToRoute = useCallback((coords) => {
    if (!coords?.length) return null;
    const sampleStep = Math.max(1, Math.floor(coords.length / 800));
    let nearest = null;
    for (const ev of filtered) {
      let minDist = Infinity;
      for (let i = 0; i < coords.length; i += sampleStep) {
        const p = coords[i];
        const d = haversineDistanceMeters(p.lat, p.lng, ev.lat, ev.lon);
        if (d < minDist) minDist = d;
      }
      if (minDist < (nearest?.dist ?? Infinity)) nearest = { ev, dist: Math.round(minDist) };
    }
    return nearest;
  }, [filtered]);

  const routeRiskScore = useCallback((poly, bufferM = 300) => {
    if (!poly?.length || filtered.length === 0) return 0;
    const step = Math.max(1, Math.floor(poly.length / 500));
    let score = 0;
    for (let i = 0; i < poly.length; i += step) {
      const p = poly[i];
      for (const ev of filtered) {
        const d = haversineDistanceMeters(p.lat, p.lng, ev.lat, ev.lon);
        if (d <= bufferM) score += 1 / (d + 1);
      }
    }
    return score;
  }, [filtered]);

  const suggestAlternateVia = useCallback(() => {
    const data = isStarted ? route : previewRoute;
    if (!data?.coords?.length || !startLoc || !endLoc) return null;

    const nearest = computeNearestEventToRoute(data.coords);
    if (!nearest?.ev) return null;

    const ev = nearest.ev;
    const R = Math.max(proximityMeters + 200, 300);
    const K = 12;
    const candidates = [];
    for (let k = 0; k < K; k++) {
      const ang = (2 * Math.PI * k) / K;
      const { dLat, dLon } = metersToDeg(ev.lat, R * Math.cos(ang), R * Math.sin(ang));
      const cand = [ev.lat + dLat, ev.lon + dLon];
      candidates.push(cand);
    }

    const quickPolyline = (a, b, segments = 50) => {
      const out = [];
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        out.push({ lat: a[0] + (b[0] - a[0]) * t, lng: a[1] + (b[1] - a[1]) * t });
      }
      return out;
    };

    let best = null;
    for (const cand of candidates) {
      const seg1 = quickPolyline(startLoc, cand, 80);
      const seg2 = quickPolyline(cand, endLoc, 80);
      const polyApprox = [...seg1, ...seg2];
      const sc = routeRiskScore(polyApprox, Math.max(250, proximityMeters));
      const d1 = haversineDistanceMeters(startLoc[0], startLoc[1], cand[0], cand[1]);
      const d2 = haversineDistanceMeters(cand[0], cand[1], endLoc[0], endLoc[1]);
      const lenPenalty = 0.0005 * (d1 + d2);
      const totalScore = sc + lenPenalty;
      if (!best || totalScore < best.totalScore) best = { via: cand, totalScore };
    }
    return best?.via || null;
  }, [isStarted, route, previewRoute, startLoc, endLoc, computeNearestEventToRoute, routeRiskScore, proximityMeters]);

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
      }
      if (minDist <= proximityMeters) {
        if (!nearest || minDist < nearest.dist) nearest = { ev, dist: Math.round(minDist) };
      }
    }
    if (!nearest) { setPreviewRiskComments([{ text: "🟢 Sin eventos cercanos (riesgo bajo)", ev: null, dist: null }]); setPreviewRiskLevel("Bajo ✅"); }
    else {
      const d = nearest.dist;
      let level = "Bajo ✅", badge = "🟢";
      if (d < 100) { level = "Alto 🔴"; badge = "🔴"; }
      else if (d <= 300) { level = "Medio 🟡"; badge = "🟡"; }
      const text = `${badge} ${nearest.ev.type} a ${formatDistanceBOG(d)} de la ruta (${level.toLowerCase()}) — ${nearest.ev.barrio || "zona desconocida"}`;
      setPreviewRiskComments([{ text, ev: nearest.ev, dist: d }]);
      setPreviewRiskLevel(level);
    }
  }, [previewRoute, filtered, proximityMeters]);

  // ======= 🔊 Disparar sonido en PREVIEW cuando cambie nivel =======
  useEffect(() => {
    const prev = lastPreviewLevelRef.current;
    const cur = (previewRiskLevel || "—").toUpperCase().includes("ALTO")
      ? "ALTO"
      : (previewRiskLevel || "—").toUpperCase().includes("MEDIO")
      ? "MEDIO"
      : "BAJO";
    if (alertSoundEnabled && cur !== prev) {
      if (cur === "ALTO" || cur === "MEDIO") {
        playPattern(cur);
      }
    }
    lastPreviewLevelRef.current = cur;
  }, [previewRiskLevel, alertSoundEnabled, playPattern]);

  // ======= Riesgo ACTIVO =======
  useEffect(() => {
    if (!route?.coords?.length) { setRiskComments([]); setRiskLevel("—"); return; }
    const coords = route.coords;
    const sampleStep = Math.max(1, Math.floor(route.coords.length / 800));
    let nearest = null;
    for (const ev of filtered) {
      let minDist = Infinity;
      for (let i = 0; i < coords.length; i += sampleStep) {
        const p = coords[i];
        const d = haversineDistanceMeters(p.lat, p.lng, ev.lat, ev.lon);
        if (d < minDist) minDist = d;
      }
      if (minDist <= proximityMeters) {
        if (!nearest || minDist < nearest.dist) nearest = { ev, dist: Math.round(minDist) };
      }
    }
    if (!nearest) { setRiskComments([{ text: "🟢 Sin eventos cercanos (riesgo bajo)", ev: null, dist: null }]); setRiskLevel("Bajo ✅"); }
    else {
      const d = nearest.dist;
      let level = "Bajo ✅", badge = "🟢";
      if (d < 100) { level = "Alto 🔴"; badge = "🔴"; }
      else if (d <= 300) { level = "Medio 🟡"; badge = "🟡"; }
      const text = `${badge} ${nearest.ev.type} a ${formatDistanceBOG(d)} de tu ruta (${level.toLowerCase()}) — ${nearest.ev.barrio || "zona desconocida"}`;
      setRiskComments([{ text, ev: nearest.ev, dist: d }]);
      setRiskLevel(level);
    }
  }, [route, filtered, proximityMeters]);

  // ======= 🔊 Disparar sonido en ACTIVO cuando cambie nivel =======
  useEffect(() => {
    const prev = lastActiveLevelRef.current;
    const cur = (riskLevel || "—").toUpperCase().includes("ALTO")
      ? "ALTO"
      : (riskLevel || "—").toUpperCase().includes("MEDIO")
      ? "MEDIO"
      : "BAJO";
    if (alertSoundEnabled && cur !== prev) {
      if (cur === "ALTO" || cur === "MEDIO") {
        playPattern(cur);
      }
    }
    lastActiveLevelRef.current = cur;
  }, [riskLevel, alertSoundEnabled, playPattern]);

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

  // ======= Cuando llega la RUTA ACTIVA =======
  const onRouteActive = useCallback((r) => { setRoute(r); setActiveInstructionIndex(0); }, []);
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
  const clearRoute = useCallback(() => {
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
    setBottomMode("summary");
    setHoveredStepLatLng(null);
    setViaPoints([]); // limpiar parada
    setViaMode(false);
    setLS("startLoc", startLoc);
  }, [stop, startLoc]);

  // ======= Reset a preview cuando cambian start/end/mode =======
  useEffect(() => {
    setIsStarted(false);
    setRoute(null);
    setInstructions([]);
    setActiveInstructionIndex(0);
    setRiskComments([]);
    setRiskLevel("—");
    setBottomMode("summary");
    setHoveredStepLatLng(null);
    setViaPoints([]); // reset parada
    setViaMode(false);
  }, [startLoc?.[0], startLoc?.[1], endLoc?.[0], endLoc?.[1], mode]);

  // ======= Persistencia de preferencias =======
  useEffect(() => { setLS("mode", mode); }, [mode]);
  useEffect(() => { setLS("proximityMeters", proximityMeters); }, [proximityMeters]);
  useEffect(() => { setLS("sidebarOpen", sidebarOpen); }, [sidebarOpen]);
  useEffect(() => { setLS("startLoc", startLoc); }, [startLoc?.[0], startLoc?.[1]]);
  useEffect(() => { setLS("endLoc", endLoc); }, [endLoc?.[0], endLoc?.[1]]);
  useEffect(() => { setLS("alertSoundEnabled", alertSoundEnabled); }, [alertSoundEnabled]);

  // ======= Center on start changes =======
  useEffect(() => {
    if (startLoc && mapRef.current) {
      try { mapRef.current.setView(startLoc, 14, { animate: true }); } catch {}
    }
  }, [startLoc]);

  // ======= Geolocalización =======
  const setMyLocationAsStart = useCallback(() => {
    if (!("geolocation" in navigator)) return alert("Tu navegador no soporta geolocalización.");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = [pos.coords.latitude, pos.coords.longitude];
        setStartLoc(coords);
        try { mapRef.current && mapRef.current.setView(coords, 15, { animate: true }); } catch {}
      },
      () => alert("No se pudo obtener tu ubicación."),
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 30000 }
    );
  }, []);

  // ======= Atajos de teclado =======
  useEffect(() => {
    const onKey = (e) => {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable)) return;
      if (e.key.toLowerCase() === "i") {
        if (!previewRoute) return;
        setIsStarted(true);
        setRoute(null);
        setInstructions([]);
        setActiveInstructionIndex(0);
        setBottomMode("instructions");
        setViaMode(false);
      } else if (e.key.toLowerCase() === "c") {
        clearRoute();
      } else if (e.key.toLowerCase() === "g") {
        setMyLocationAsStart();
      } else if (e.key.toLowerCase() === "v") {
        setViaMode(v => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewRoute, clearRoute, setMyLocationAsStart]);

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

        /* ===== Splash Animations ===== */
        @keyframes fadeInUp { 0% { opacity: 0; transform: translateY(8px) scale(.985);} 100% { opacity:1; transform: none; } }
        @keyframes barSlide { 0% { transform: translateX(-60%);} 100% { transform: translateX(160%);} }
        @keyframes slowPan { 0% { transform: translate(-2%, -1%) scale(1.03);} 50% { transform: translate(2%, 1%) scale(1.04);} 100% { transform: translate(-2%, -1%) scale(1.03);} }
        @keyframes heatDrift { 0% { transform: translate(-5%, -3%) scale(1.05);} 50% { transform: translate(6%, 4%) scale(1.08);} 100% { transform: translate(-5%, -3%) scale(1.05);} }

        .splashTitleAnim { animation: fadeInUp .8s ease both; background-size: 220% 100%; }
        .splashSubAnim  { animation: fadeInUp .8s ease .18s both; color:#a6b8cc !important; }

        .bg-layer { position:absolute; inset:0; pointer-events:none; }
        .heat { opacity:.35; filter: blur(30px) saturate(1.05); animation: heatDrift 22s ease-in-out infinite; }
        .topo { opacity:.55; mix-blend-mode:screen; }
        .topo > svg { width:140%; height:140%; animation: slowPan 26s ease-in-out infinite; }

        .net { opacity:.75; filter: saturate(1.1); }
        .route-base { fill:none; stroke-linecap:round; stroke-linejoin:round; opacity:.22; }
        .route-progress { fill:none; stroke-linecap:round; stroke-linejoin:round; }
        .route-progress { stroke-dasharray: 0 2600; }
        .route-car  { stroke:#4ec9ff; }
        .route-walk { stroke:#f59e0b; }
        .route-moto { stroke:#a78bfa; }

        .car, .moto, .walker { filter: drop-shadow(0 4px 10px rgba(79,209,255,.35)); }
        .car-body { fill:#ffffff; } .car-accent { fill:#4ec9ff; } .car-wheel { fill:#0f172a; }
        .bike-wheel { fill:#0f172a; } .bike-body { fill:#a78bfa; }
        .walker-head { fill:#ffffff; } .walker-body { fill:#f59e0b; }

        .jjss { background: linear-gradient(90deg, rgba(96,165,250,.25), rgba(34,211,238,.25), rgba(167,139,250,.25)); }

        @media (prefers-reduced-motion: reduce) {
          .splashTitleAnim, .splashSubAnim, .topo > svg, .heat { animation: none !important; }
        }

        /* ===== UI base ===== */
        .badge {
          display:inline-flex; align-items:center; gap:6px;
          font-size:12px; padding:4px 8px; border-radius:9999px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .btn-primary { background:#2563eb; color:#fff; border: none; }
        .btn-plain { background:transparent; color:#9fb4c9; border:1px solid rgba(255,255,255,0.08); }
        .btn-alt { background:#0ea5e9; color:#fff; border:none; }
        .card { background:#041021; border-radius:12px; padding:12px; border:1px solid rgba(255,255,255,0.06); }

        .hamb-line { display:block; width:28px; height:3px; background:#ffffff; margin:5px 0; border-radius:2px; }
        button.hamb:focus-visible { outline: 3px solid #93c5fd; outline-offset: 2px; }
        button.hamb:hover { transform: translateY(-1px); box-shadow: 0 10px 28px rgba(0,0,0,0.7); background: rgba(5,16,36,0.95); }

        @keyframes pulseHigh { 0% { box-shadow: 0 0 0 rgba(239,68,68,0.0); } 50% { box-shadow: 0 0 44px rgba(239,68,68,0.85); } 100% { box-shadow: 0 0 0 rgba(239,68,68,0.0); } }
        @keyframes pulseMedium { 0% { box-shadow: 0 0 0 rgba(245,158,11,0.0); } 50% { box-shadow: 0 0 36px rgba(245,158,11,0.75); } 100% { box-shadow: 0 0 0 rgba(245,158,11,0.0); } }
        @keyframes pulseLow { 0% { box-shadow: 0 0 0 rgba(16,185,129,0.0); } 50% { box-shadow: 0 0 28px rgba(16,185,129,0.6); } 100% { box-shadow: 0 0 0 rgba(16,185,129,0.0); } }

        .panel-friendly { position: relative; align-items: stretch; overflow: hidden; }
        .panel-friendly::before { content: ""; position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity .2s ease; }
        @keyframes bgPulseHigh { 0%{opacity:0;} 50%{opacity:.75;} 100%{opacity:0;} }
        @keyframes bgPulseMedium { 0%{opacity:0;} 50%{opacity:.6;} 100%{opacity:0;} }
        @keyframes bgPulseLow { 0%{opacity:0;} 50%{opacity:.45;} 100%{opacity:0;} }

        .panel-alert-high { background: linear-gradient(180deg, rgba(38,9,9,0.95), rgba(22,6,6,0.98)); }
        .panel-alert-medium { background: linear-gradient(180deg, rgba(38,28,8,0.94), rgba(24,17,6,0.97)); }
        .panel-alert-low { background: linear-gradient(180deg, rgba(7,28,22,0.92), rgba(5,20,16,0.96)); }
        .panel-alert-high.panel-friendly::before { background: rgba(239,68,68,0.85); animation: bgPulseHigh .95s infinite; }
        .panel-alert-medium.panel-friendly::before { background: rgba(245,158,11,0.7); animation: bgPulseMedium 1.1s infinite; }
        .panel-alert-low.panel-friendly::before { background: rgba(16,185,129,0.55); animation: bgPulseLow 1.25s infinite; }

        .chip { display:inline-flex; align-items:center; gap:8px; padding:6px 10px; border-radius:9999px; background: rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.08); font-size:12px; }
        .chip.level { font-weight:800; }
        .chip.tab { cursor:pointer; user-select:none; }
        .chip-pulse-high { animation: pulseHigh .95s infinite; border-color: rgba(239,68,68,0.85) !important; }
        .chip-pulse-medium { animation: pulseMedium 1.1s infinite; border-color: rgba(245,158,11,0.75) !important; }
        .chip-pulse-low { animation: pulseLow 1.25s infinite; border-color: rgba(16,185,129,0.6) !important; }
        .dot { width:10px; height:10px; border-radius:9999px; display:inline-block; }
        .dot.high{ background:#ef4444; } .dot.medium{ background:#f59e0b; } .dot.low{ background:#10b981; }
        .advice { margin-top:10px; font-size:15px; line-height:1.35; color:#e9f2ff; font-weight:700; }
        .panel-right { min-width:200px; text-align:right; padding-left:12px; border-left:1px solid rgba(255,255,255,.06);
          display:flex; gap:10px; align-items:center; justify-content:flex-end; flex-wrap:wrap; }

        .metric .label { font-size:12px; color:#9fb4c9; }
        .metric .value { margin-top:4px; font-weight:800; }

        /* ======= RESPONSIVE ======= */
        @media (max-width: 768px) {
          .card { border-radius: 10px; padding: 10px; }
          .chip { padding: 6px 8px; font-size: 11px; }
          .metric .label { font-size: 11px; }
          .metric .value { font-size: 14px; }

          /* Mueve el ZoomControl un poco más abajo */
          .leaflet-top.leaflet-right { top: calc(env(safe-area-inset-top, 0px) + 62px); }

          /* Suaviza sombras para performance en móvil */
          .jjss, .panel-friendly, .hamb, .leaflet-control-zoom {
            box-shadow: 0 6px 16px rgba(0,0,0,0.45) !important;
          }
        }
      `}</style>

      {/* Splash */}
      {showSplash && (
        <div style={styles.splash} role="dialog" aria-label="Cargando SafeMap" aria-live="polite">
          <div
            className="bg-layer heat"
            aria-hidden="true"
            style={{
              background:
                "radial-gradient(900px 700px at 15% 15%, rgba(96,165,250,.22), transparent 60%), radial-gradient(1000px 800px at 90% 80%, rgba(34,211,238,.22), transparent 60%), radial-gradient(800px 700px at 50% 40%, rgba(167,139,250,.20), transparent 60%)",
            }}
          />
          <div className="bg-layer topo" aria-hidden="true">
            <svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
              {[...Array(9)].map((_, i) => (
                <path
                  key={i}
                  d={`M-240 ${90 + i * 90} C 200 ${50 + i * 90}, 420 ${140 + i * 90}, 820 ${80 + i * 90} S 1460 ${160 + i * 90}, 1900 ${110 + i * 90}`}
                  fill="none"
                  stroke={i % 3 === 0 ? "#5bd5ff" : i % 3 === 1 ? "#9fc5ff" : "#a48bff"}
                  strokeOpacity={0.09 + (i % 3 === 0 ? 0.05 : 0)}
                  strokeWidth={2}
                />
              ))}
            </svg>
          </div>

          <svg className="bg-layer net" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <g opacity="0.22" stroke="#5bd5ff">
              <path d="M0 140 H1440 M0 300 H1440 M0 520 H1440 M0 760 H1440" strokeOpacity=".22" />
              <path d="M140 0 V900 M360 0 V900 M640 0 V900 M980 0 V900 M1220 0 V900" strokeOpacity=".14" />
            </g>
            <path id="routeCar" className="route-base route-car"
              d="M-200 760 C 120 700, 360 660, 620 560 S 1040 420, 1220 410 S 1640 420, 1700 360" strokeWidth="4" />
            <path className="route-progress route-car"
              d="M-200 760 C 120 700, 360 660, 620 560 S 1040 420, 1220 410 S 1640 420, 1700 360" strokeWidth="6">
              <animate attributeName="stroke-dasharray" values="0,2600; 2600,0" dur="6s" repeatCount="indefinite" />
            </path>
            <g className="car">
              <g>
                <rect className="car-body" x="-12" y="-7" rx="3" ry="3" width="24" height="14" />
                <rect className="car-accent" x="-6" y="-4" rx="2" ry="2" width="12" height="8" />
                <circle className="car-wheel" cx="-7" cy="8" r="3" />
                <circle className="car-wheel" cx="7" cy="8" r="3" />
              </g>
              <animateMotion dur="6s" repeatCount="indefinite" rotate="auto">
                <mpath href="#routeCar" />
              </animateMotion>
            </g>

            <path id="routeWalk" className="route-base route-walk"
              d="M-220 620 C 60 610, 240 560, 480 520 S 900 480, 1160 520 S 1600 580, 1700 640" strokeWidth="3.5" />
            <path className="route-progress route-walk"
              d="M-220 620 C 60 610, 240 560, 480 520 S 900 480, 1160 520 S 1600 580, 1700 640" strokeWidth="5">
              <animate attributeName="stroke-dasharray" values="0,2600; 2600,0" dur="7s" repeatCount="indefinite" />
            </path>
            <g className="walker">
              <circle className="walker-head" r="5" cy="-14" />
              <rect className="walker-body" x="-3" y="-13" width="6" height="18" rx="2" />
              <rect className="walker-body" x="-8" y="2" width="6" height="10" rx="2" />
              <rect className="walker-body" x="2" y="2" width="6" height="10" rx="2" />
              <animateMotion dur="7s" repeatCount="indefinite" rotate="auto">
                <mpath href="#routeWalk" />
              </animateMotion>
            </g>

            <path id="routeMoto" className="route-base route-moto"
              d="M-240 480 C 80 520, 300 480, 560 440 S 980 360, 1240 340 S 1600 320, 1720 300" strokeWidth="3.5" />
            <path className="route-progress route-moto"
              d="M-240 480 C 80 520, 300 480, 560 440 S 980 360, 1240 340 S 1600 320, 1720 300" strokeWidth="5">
              <animate attributeName="stroke-dasharray" values="0,2600; 2600,0" dur="5s" repeatCount="indefinite" />
            </path>
            <g className="moto">
              <circle className="bike-wheel" r="4.2" cx="-9" cy="8" />
              <circle className="bike-wheel" r="4.2" cx="9" cy="8" />
              <rect className="bike-body" x="-8" y="-2" width="16" height="6" rx="2" />
              <rect className="bike-body" x="-2" y="-6" width="10" height="4" rx="1.5" />
              <animateMotion dur="5s" repeatCount="indefinite" rotate="auto">
                <mpath href="#routeMoto" />
              </animateMotion>
            </g>
          </svg>

          <div style={styles.splashCenter}>
            <div style={styles.splashTitle} className="splashTitleAnim">SafeMap</div>
            <div style={styles.splashSubtitle} className="splashSubAnim">
              Rutas y seguridad urbana en tiempo real
            </div>

            <div style={styles.splashLoaderTrack} aria-hidden="true">
              <div style={styles.splashLoaderBar} />
            </div>

            <div style={{ ...styles.jjssWrap, marginTop: 18 }} className="jjss" aria-label="Hecho por JJSS">
              <strong style={styles.jjssMonogram}>
                <span style={{background:"linear-gradient(90deg,#9fc5ff,#5bd5ff,#a48bff)",WebkitBackgroundClip:"text",backgroundClip:"text",color:"transparent"}}>J</span>
                <span style={{background:"linear-gradient(90deg,#9fc5ff,#5bd5ff,#a48bff)",WebkitBackgroundClip:"text",backgroundClip:"text",color:"transparent"}}>J</span>
                <span style={{background:"linear-gradient(90deg,#9fc5ff,#5bd5ff,#a48bff)",WebkitBackgroundClip:"text",backgroundClip:"text",color:"transparent"}}>S</span>
                <span style={{background:"linear-gradient(90deg,#9fc5ff,#5bd5ff,#a48bff)",WebkitBackgroundClip:"text",backgroundClip:"text",color:"transparent"}}>S</span>
              </strong>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: "#8fa6bd" }}>
              Preparando el mapa…
            </div>
          </div>
        </div>
      )}

      {/* Botón hamburguesa */}
      {!sidebarOpen && !showSplash && (
        <button
          aria-label="Mostrar panel"
          aria-controls="sidepanel"
          title="Mostrar panel"
          className="hamb"
          style={{
            ...styles.hamburger,
            left: isMobile ? 10 : styles.hamburger.left,
            padding: isMobile ? "12px 14px" : styles.hamburger.padding,
          }}
          onClick={() => setSidebarOpen(true)}
        >
          <span className="hamb-line" />
          <span className="hamb-line" />
          <span className="hamb-line" />
        </button>
      )}

      {/* Botón geolocalización */}
      {!showSplash && (
        <button
          type="button"
          aria-label="Usar mi ubicación como inicio (g)"
          title="Usar mi ubicación como inicio (g)"
          style={{
            ...styles.geoBtn,
            top: isMobile ? "auto" : styles.geoBtn.top,
            bottom: isMobile ? "calc(env(safe-area-inset-bottom, 0px) + 96px)" : "auto",
            right: isMobile ? 12 + 56 : styles.geoBtn.right, // corre para dejar sitio al viaBtn
          }}
          onClick={setMyLocationAsStart}
        >
          📍
        </button>
      )}

      {/* ⭐ Botón flotante: Modo colocar PARADA */}
      {!showSplash && (
        <button
          type="button"
          aria-label="Colocar parada (v)"
          title="Colocar parada (v)"
          style={{
            ...styles.viaBtn,
            top: isMobile ? "auto" : styles.viaBtn.top,
            bottom: isMobile ? "calc(env(safe-area-inset-bottom, 0px) + 36px)" : "auto",
            right: isMobile ? 12 : styles.viaBtn.right,
            borderColor: viaMode ? "rgba(167,139,250,0.95)" : "rgba(255,255,255,0.9)",
            background: viaMode ? "rgba(167,139,250,0.18)" : "rgba(2,10,28,0.9)",
          }}
          onClick={() => setViaMode(v => !v)}
        >
          {viaMode ? "🟣 Parada: ON" : "◯ Parada"}
        </button>
      )}

      {/* Sidebar */}
      <aside
        id="sidepanel"
        style={{
          ...styles.sidebar,
          width: getSidebarWidth(),
          maxWidth: isMobile ? "100vw" : "92vw",
          ...(sidebarOpen ? styles.sidebarOpen : null),
        }}
      >
        {sidebarOpen && (
          <button
            aria-label="Ocultar panel"
            title="Ocultar panel"
            style={{
              ...styles.closeFab,
              width: isMobile ? 42 : styles.closeFab.width,
              height: isMobile ? 42 : styles.closeFab.height,
              right: isMobile ? 10 : styles.closeFab.right,
              top: isMobile ? "calc(env(safe-area-inset-top, 0px) + 8px)" : styles.closeFab.top,
            }}
            onClick={() => setSidebarOpen(false)}
            onMouseDown={(e) => e.preventDefault()}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        )}

        <div>
          <div style={{...styles.title, fontSize: isMobile ? 16 : 18}}>🧭 Mapa de Riesgo Pro</div>
          <div style={{...styles.small, fontSize: isMobile ? 12 : 12.5}}>Ruta + filtro por localidad</div>
          {loading && <div style={{ color: "#9fb4c9", fontSize: 12, marginTop: 6 }}>Cargando datos…</div>}
          {loadError && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 6 }}>{loadError}</div>}
        </div>

        {/* Controles de Ruta */}
        <div className="card" style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 800, marginBottom: 6, fontSize: isMobile ? 14 : 16 }}>Ruta</div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ color: "#9fb4c9", fontSize: 13 }}>Inicio</label>
            <SearchBox onSelectLocation={(coords) => setStartLoc(coords)} placeholder="Buscar inicio..." />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ color: "#9fb4c9", fontSize: 13 }}>Destino</label>
            <SearchBox onSelectLocation={(coords) => setEndLoc(coords)} placeholder="Buscar destino..." />
          </div>

          {/* Info de parada manual */}
          <div style={{ marginBottom: 8, color: "#6b7280", fontSize: 12 }}>
            Usa el botón flotante <strong>“Parada”</strong> y toca el mapa para colocarla.
            Puedes arrastrar el marcador y con <em>clic derecho</em> lo quitas.
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: isMobile ? "wrap" : "nowrap" }}>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              style={{ flex: 1, minWidth: 140, padding: 10, borderRadius: 10, background: "#061226", color: "#e6eef8", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <option value="car">🚗 Vehículo</option>
              <option value="walk">🚶‍♂️ Caminando</option>
            </select>

            <button
              className="btn-primary"
              style={{ padding: "10px 12px", borderRadius: 10, flex: isMobile ? "1 1 48%" : "0 0 auto" }}
              onClick={() => {
                if (!previewRoute) return alert("Traza primero una ruta (elige inicio y destino).");
                setIsStarted(true);
                setRoute(null);
                setInstructions([]);
                setActiveInstructionIndex(0);
                setBottomMode("instructions");
                setViaMode(false);
              }}
              title="Iniciar navegación (i)"
              aria-label="Iniciar navegación"
            >
              Iniciar
            </button>

            <button
              className="btn-plain"
              style={{ padding: "10px 12px", borderRadius: 10, flex: isMobile ? "1 1 48%" : "0 0 auto" }}
              onClick={clearRoute}
              title="Limpiar (c)"
              aria-label="Limpiar"
            >
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
              style={{ width: "100%", marginTop: 6, touchAction: "none" }}
            />
          </div>

          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#9fb4c9" }}>
              <input
                type="checkbox"
                checked={showInstructions}
                onChange={(e) => setShowInstructions(e.target.checked)}
              />
              Voz (TTS)
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#9fb4c9" }}>
              <input
                type="checkbox"
                checked={alertSoundEnabled}
                onChange={(e) => setAlertSoundEnabled(e.target.checked)}
              />
              Sonido alerta
            </label>

            <div style={{ marginLeft: "auto", color: "#86a6bf", fontSize: 12 }}>
              {isStarted && route ? `${formatDistanceBOG(route.distance)} • ${formatDurationBOG(route.time)}`
                : previewRoute ? `Preview: ${formatDistanceBOG(previewRoute.distance)} • ${formatDurationBOG(previewRoute.time)}`
                : "—"}
            </div>
          </div>
        </div>

        {/* Filtro ÚNICO: Localidad */}
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 6, fontSize: isMobile ? 14 : 16 }}>Filtro por Localidad</div>
          <input
            type="text"
            value={localidadText}
            onChange={(e) => setLocalidadText(e.target.value)}
            placeholder="Escribe la localidad…"
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "10px",
              background: "#061226",
              color: "#e6eef8",
              border: "1px solid rgba(255,255,255,0.06)",
              boxSizing: "border-box",
            }}
          />
          <div style={{ marginTop: 6, color: "#6b7280", fontSize: 12 }}>
            (Se aplica automáticamente)
          </div>
        </div>

        <div style={{ marginTop: 12, color: "#6b7280", fontSize: 12, paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          Tip: Doble clic en el mapa para marcar inicio/destino. Usa “Iniciar” para comenzar navegación y voz.
        </div>
      </aside>

      {/* Map area */}
      <div style={styles.mapWrap}>
        <MapContainer
          center={startLoc || [4.60971, -74.08175]}
          zoom={startLoc ? 14 : 12}
          style={{ height: "100%", width: "100%" }}
          doubleClickZoom={false}
          zoomControl={false}
          whenCreated={(m) => {
            mapRef.current = m;
            requestAnimationFrame(() => { try { m.invalidateSize(); } catch {} });
            setTimeout(() => { try { m.invalidateSize(); } catch {} }, 250);
          }}
        >
          <ZoomControl position="topright" />
          <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {/* Heatmap */}
          <HeatmapLayer points={heatPoints} />

          {/* Doble clic inicio/fin */}
          <MapClickHandler onSetStart={setStartLoc} onSetEnd={setEndLoc} />

          {/* ⭐ Colocar PARADA cuando viaMode está activo */}
          <MapViaSetter active={viaMode} onSetVia={(coords) => setViaPoints(coords ? [coords] : [])} />

          {/* Start/End markers */}
          {startLoc && <Marker position={startLoc}><Popup>Inicio</Popup></Marker>}
          {endLoc && <Marker position={endLoc}><Popup>Destino</Popup></Marker>}

          {/* ⭐ Marker de PARADA */}
          {viaPoints.length > 0 && (
            <Marker
              position={viaPoints[0]}
              icon={viaIcon}
              draggable={true}
              eventHandlers={{
                dragend: (e) => {
                  const latlng = e.target.getLatLng();
                  setViaPoints([[latlng.lat, latlng.lng]]);
                },
                contextmenu: () => setViaPoints([]),
              }}
            >
              <Popup>Parada</Popup>
            </Marker>
          )}

          {/* PREVIEW */}
          {startLoc && endLoc && !isStarted && (
            <GenericRoutingMachine
              start={startLoc}
              end={endLoc}
              mode={mode}
              onRoute={setPreviewRoute}
              onInstructions={setPreviewInstructions}
              speakEnabled={false}
              isPreview={true}
              fitSelected={true}
              viaPoints={viaPoints}
            />
          )}

          {/* ACTIVA */}
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
              viaPoints={viaPoints}
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
                <Popup>{`${p.ev.type} a ${formatDistanceBOG(p.dist)}`}</Popup>
              </CircleMarker>
            ));
          })()}

          {/* Marcador del paso bajo hover */}
          {hoveredStepLatLng && (
            <CircleMarker
              center={[hoveredStepLatLng.lat, hoveredStepLatLng.lng]}
              radius={9}
              pathOptions={{ color: "#60a5fa", weight: 3, opacity: 0.95 }}
            />
          )}
        </MapContainer>

        {/* Panel inferior (minimizable) */}
        {(previewRoute || route) && (
          (() => {
            const isActive = isStarted;
            const lvl = isActive ? riskLevel : previewRiskLevel;
            const clsPanel = bottomMode === "summary" ? (
              (lvl.includes("Alto") && "panel-alert-high") ||
              (lvl.includes("Medio") && "panel-alert-medium") ||
              (lvl.includes("Bajo") && "panel-alert-low") || ""
            ) : "";
            const lbl = (lvl.includes("Alto") && "ALTO") || (lvl.includes("Medio") && "MEDIO") || (lvl.includes("Bajo") && "BAJO") || "—";

            const data = isActive ? route : previewRoute;
            const dist = data ? formatDistanceBOG(data.distance) : "—";
            const tim = data ? formatDurationBOG(data.time) : "—";
            const steps = isActive ? (instructions || []) : (previewInstructions || []);

            const levelKey = (lbl === "ALTO" ? "high" : lbl === "MEDIO" ? "medium" : "low");
            const chipPulseClass =
              bottomMode === "summary"
                ? (levelKey === "high" ? "chip-pulse-high" : levelKey === "medium" ? "chip-pulse-medium" : levelKey === "low" ? "chip-pulse-low" : "")
                : "";

            const showAltBtn = /ALTO|MEDIO/.test(lbl) && startLoc && endLoc;
            const showStartBtn = !!previewRoute && !isStarted;

            // Posicionamiento común para la barra minimizada
            const miniPosStyle = {
              left: isMobile ? 8 : bottomPanelLeft,
              right: isMobile ? 8 : 12,
              bottom: isMobile ? "calc(env(safe-area-inset-bottom, 0px) + 8px)" : 14,
            };

            if (isAlertMinimized) {
              // ======== VISTA MINIMIZADA ========
              return (
                <div
                  style={{ ...styles.miniBar, ...miniPosStyle, justifyContent: "space-between" }}
                  className={`${clsPanel}`}
                  role="region"
                  aria-label="Panel de alertas minimizado"
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className={`chip level ${chipPulseClass}`} title={`Nivel ${lbl}`}>
                      <span className={`dot ${levelKey}`} /> {lbl}
                    </span>
                    <span className="chip" title="Resumen distancia/tiempo">
                      🛣️ {dist} • ⏱️ {tim}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {/* Iniciar desde mini-bar (si aplica) */}
                    {showStartBtn && (
                      <button
                        className="btn-primary"
                        style={{ padding: "8px 10px", borderRadius: 10 }}
                        onClick={() => {
                          if (!previewRoute) return alert("Traza primero una ruta (elige inicio y destino).");
                          setIsStarted(true);
                          setRoute(null);
                          setInstructions([]);
                          setActiveInstructionIndex(0);
                          setBottomMode("instructions");
                          setViaMode(false);
                        }}
                        title="Iniciar navegación"
                      >
                        ▶ Iniciar
                      </button>
                    )}

                    {/* Ruta alterna cuando aplica */}
                    {showAltBtn && (
                      <button
                        className="btn-alt"
                        style={{ padding: "8px 10px", borderRadius: 10 }}
                        onClick={() => {
                          const via = suggestAlternateVia();
                          if (!via) return alert("No encontré una vía alternativa adecuada.");
                          setViaPoints([via]);
                          setIsStarted(true);
                          setBottomMode("instructions");
                          setViaMode(false);
                        }}
                        title="Ruta alterna"
                      >
                        ↺ Alterna
                      </button>
                    )}

                    {/* Botón restaurar */}
                    <button
                      type="button"
                      style={styles.miniToggleBtn}
                      onClick={() => setIsAlertMinimized(false)}
                      title="Expandir panel de alertas"
                      aria-label="Expandir panel de alertas"
                    >
                      ⤢ Expandir
                    </button>
                  </div>
                </div>
              );
            }

            // ======== VISTA COMPLETA ========
            const bottomPanelStyle = {
              ...styles.bottomPanel,
              left: isMobile ? 8 : bottomPanelLeft,
              right: isMobile ? 8 : 12,
              bottom: isMobile ? "calc(env(safe-area-inset-bottom, 0px) + 8px)" : 14,
              minWidth: isMobile ? "unset" : styles.bottomPanel.minWidth,
              width: isMobile ? "auto" : undefined,
              maxWidth: isMobile ? "unset" : styles.bottomPanel.maxWidth,
              flexDirection: isMobile ? "column" : "row",
              gap: isMobile ? 10 : 14,
              padding: isMobile ? 10 : 12,
              borderRadius: isMobile ? 12 : 14,
            };

            const instrListStyle = {
              ...styles.instrList,
              maxHeight: isMobile ? "34vh" : styles.instrList.maxHeight,
            };

            return (
              <div
                style={bottomPanelStyle}
                className={`${clsPanel} panel-friendly`}
                role="region"
                aria-live="polite"
                aria-label={bottomMode === "instructions" ? "Indicaciones de la ruta" : "Resumen de la ruta"}
              >
                <div style={{ ...styles.bottomLeft }}>
                  <div className="row" style={{ alignItems: "center", gap: isMobile ? 6 : 8, flexWrap: "wrap" }}>
                    <span className="chip">{isActive ? "🧭 Navegación activa" : "👀 Vista previa"}</span>
                    <span className="chip">{mode === "walk" ? "Caminando 🚶" : "Vehículo 🚗"}</span>
                    <span className={`chip level ${chipPulseClass}`}>
                      <span className={`dot ${levelKey}`} /> Nivel {lbl}
                    </span>

                    <span
                      className="chip tab"
                      style={{
                        ...styles.chipTab,
                        marginLeft: "auto",
                        borderColor: bottomMode === "instructions" ? "rgba(96,165,250,0.6)" : "rgba(255,255,255,0.08)",
                        background: bottomMode === "instructions" ? "rgba(96,165,250,0.15)" : "rgba(255,255,255,0.06)"
                      }}
                      onClick={() => setBottomMode("instructions")}
                    >
                      📜 Indicaciones
                    </span>
                    <span
                      className="chip tab"
                      style={{
                        ...styles.chipTab,
                        borderColor: bottomMode === "summary" ? "rgba(96,165,250,0.6)" : "rgba(255,255,255,0.08)",
                        background: bottomMode === "summary" ? "rgba(96,165,250,0.15)" : "rgba(255,255,255,0.06)"
                      }}
                      onClick={() => setBottomMode("summary")}
                    >
                      🧩 Resumen
                    </span>

                    {/* Botón para minimizar */}
                    <button
                      type="button"
                      style={{ ...styles.miniToggleBtn }}
                      onClick={() => setIsAlertMinimized(true)}
                      title="Minimizar panel de alertas"
                      aria-label="Minimizar panel de alertas"
                    >
                      ⤡ Minimizar
                    </button>
                  </div>

                  {bottomMode === "instructions" ? (
                    <div style={instrListStyle}>
                      {steps.length === 0 ? (
                        <div style={{ color: "#9fb4c9", fontSize: 13 }}>Sin indicaciones disponibles.</div>
                      ) : (
                        <ol style={{ margin: 0, paddingLeft: 18 }}>
                          {steps.map((s, i) => {
                            const active = i === activeInstructionIndex && isActive;
                            const hasPoint = !!s.raw?.latLng;
                            return (
                              <li key={i} style={{ marginBottom: 8 }}>
                                <div
                                  style={{ ...styles.instrItem, ...(active ? styles.instrItemActive : {}) }}
                                  onMouseEnter={() => {
                                    if (hasPoint) {
                                      setHoveredStepLatLng(s.raw.latLng);
                                      try {
                                        mapRef.current &&
                                          mapRef.current.setView(
                                            [s.raw.latLng.lat, s.raw.latLng.lng],
                                            Math.max(15, mapRef.current.getZoom() || 15),
                                            { animate: true }
                                          );
                                      } catch {}
                                    }
                                  }}
                                  onMouseLeave={() => setHoveredStepLatLng(null)}
                                  title={hasPoint ? "Ver este paso en el mapa" : "Paso sin punto georreferenciado"}
                                >
                                  <div style={{ fontWeight: 700, marginBottom: 2 }}>{s.human}</div>
                                  {s.raw?.distance != null && (
                                    <div style={{ fontSize: 12, color: "#9fb4c9" }}>
                                      {formatDistanceBOG(s.raw.distance)} • {Math.max(1, Math.round((s.raw.time || 0) / 60))} min aprox.
                                    </div>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      )}
                    </div>
                  ) : (
                    <div className="advice" style={{ fontSize: isMobile ? 14 : 15 }}>
                      {lvl.includes("Alto")
                        ? (mode === "walk"
                          ? "Evita calles poco iluminadas o solas. Mantente en avenidas principales, comparte tu ubicación y considera una ruta alternativa."
                          : "Prefiere vías principales e iluminadas. Evita detenerte; puertas y ventanas aseguradas. Considera una ruta alternativa.")
                        : lvl.includes("Medio")
                        ? (mode === "walk"
                          ? "Mantén atención al entorno y tus pertenencias. Evita atajos y zonas estrechas."
                          : "Conduce con precaución y evita calles estrechas. No te detengas innecesariamente.")
                        : (mode === "walk"
                          ? "Ruta recomendable. Aun así, mantén atención al entorno."
                          : "Ruta recomendable. Conduce atento y respeta señales.")
                      }
                    </div>
                  )}
                </div>

                <div className="panel-right" style={{
                  minWidth: isMobile ? "unset" : 200,
                  paddingLeft: isMobile ? 0 : 12,
                  borderLeft: isMobile ? "none" : "1px solid rgba(255,255,255,.06)",
                  justifyContent: isMobile ? "space-between" : "flex-end",
                  width: isMobile ? "100%" : "auto",
                }}>
                  <div className="metric">
                    <div className="label">Distancia</div>
                    <div className="value">{dist}</div>
                  </div>
                  <div className="metric">
                    <div className="label">Tiempo</div>
                    <div className="value">{tim}</div>
                  </div>

                  {/* Botones de acción */}
                  {showStartBtn && (
                    <button
                      className="btn-primary"
                      style={{ padding: "10px 12px", borderRadius: 10, width: isMobile ? "100%" : "auto" }}
                      onClick={() => {
                        if (!previewRoute) return alert("Traza primero una ruta (elige inicio y destino).");
                        setIsStarted(true);
                        setRoute(null);
                        setInstructions([]);
                        setActiveInstructionIndex(0);
                        setBottomMode("instructions");
                        setViaMode(false);
                      }}
                      title="Iniciar navegación (i)"
                    >
                      Iniciar
                    </button>
                  )}

                  {showAltBtn && (
                    <button
                      className="btn-alt"
                      style={{ padding: "10px 12px", borderRadius: 10, width: isMobile ? "100%" : "auto" }}
                      onClick={() => {
                        const via = suggestAlternateVia();
                        if (!via) return alert("No encontré una vía alternativa adecuada.");
                        setViaPoints([via]);
                        setIsStarted(true);
                        setBottomMode("instructions");
                        setViaMode(false);
                      }}
                      title="Crear una ruta alterna que evite la zona de mayor riesgo"
                    >
                      Ruta alterna
                    </button>
                  )}
                </div>
              </div>
            );
          })()
        )}

      </div>
    </div>
  );
}
