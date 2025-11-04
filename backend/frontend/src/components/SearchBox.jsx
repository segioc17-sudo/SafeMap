import React, { useState } from "react";
import axios from "axios";

export default function SearchBox({ onSelectLocation }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchAddress = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await axios.get(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`
      );
      setResults(res.data);
    } catch (err) {
      console.error("Error buscando dirección:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <div style={{ display: "flex", gap: "5px" }}>
        <input
          type="text"
          placeholder="Buscar dirección..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1, padding: "5px", borderRadius: "4px", border: "1px solid #666" }}
        />
        <button onClick={searchAddress} style={{ padding: "5px 10px", cursor: "pointer" }}>
          🔍
        </button>
      </div>

      {loading && <small>Buscando...</small>}

      {results.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: "120px", overflowY: "auto", background: "#222", borderRadius: "4px" }}>
          {results.map((place, idx) => (
            <li
              key={idx}
              onClick={() => {
                onSelectLocation([parseFloat(place.lat), parseFloat(place.lon)]);
                setResults([]);
                setQuery(place.display_name);
              }}
              style={{ padding: "5px", cursor: "pointer", borderBottom: "1px solid #333" }}
            >
              {place.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
