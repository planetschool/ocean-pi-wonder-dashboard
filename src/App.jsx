import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";

const RENDER_API_URL = "https://ocean-pi-mqtt-bridge.onrender.com";
const DECK_CAM_URL = "https://pub-a4d32c79b4774731968323149e554ee7.r2.dev/latest/deck.jpg";
const BOW_CAM_URL = "https://pub-a4d32c79b4774731968323149e554ee7.r2.dev/latest/bow.jpg";

const WONDER_ICON = "/wonder-icon.png";
const WONDER_TOPDOWN = "/wonder-topdown.png";

function App() {
  const nmea = useLiveNmea();
  const liveTrack = useLiveTrack();
  const [route, setRoute] = useState(null);
  const [progress, setProgress] = useState(0.98);
  const [mapMode, setMapMode] = useState("live");

  useEffect(() => {
    fetch("/voyage-route.json")
      .then((r) => r.json())
      .then(setRoute)
      .catch((err) => console.error("Could not load voyage route", err));
  }, []);

  const live = useMemo(() => buildLiveData(nmea), [nmea]);

  return (
    <div className="page-shell">
      <div className="dashboard-frame">
        <Header live={live} />

        <main className="main-grid">
          <section className="left-stack">
            <div className="camera-grid">
              <CameraPanel title="Deck Cam" url={DECK_CAM_URL} refreshMs={5000} />
              <CameraPanel title="Bow Cam" url={BOW_CAM_URL} refreshMs={30000} />
            </div>

            <VoyageMap
              route={route}
              liveTrack={liveTrack}
              progress={progress}
              setProgress={setProgress}
              mapMode={mapMode}
              setMapMode={setMapMode}
              live={live}
            />
          </section>

          <aside className="right-stack">
            <MotionPanel live={live} />
            <VesselSystems live={live} />
            <BatteryPanel live={live} />
            <EnvironmentPanel live={live} />
          </aside>
        </main>

        <Footer live={live} />
      </div>
    </div>
  );
}

function useLiveNmea() {
  const [data, setData] = useState(null);

  useEffect(() => {
    async function fetchNmea() {
      try {
        const res = await fetch(`${RENDER_API_URL}/api/nmea2000`);
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("NMEA fetch failed:", err);
      }
    }

    fetchNmea();
    const id = setInterval(fetchNmea, 1000);
    return () => clearInterval(id);
  }, []);

  return data;
}

function useLiveTrack() {
  const [track, setTrack] = useState(null);

  useEffect(() => {
    async function fetchTrack() {
      try {
        const res = await fetch(`${RENDER_API_URL}/api/track`);
        const json = await res.json();
        setTrack(json);
      } catch (err) {
        console.error("Track fetch failed:", err);
      }
    }

    fetchTrack();

    const id = setInterval(fetchTrack, 30000);

    return () => clearInterval(id);
  }, []);

  return track;
}

function useRefreshingImage(url, refreshMs) {
  const [version, setVersion] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setVersion(Date.now()), refreshMs);
    return () => clearInterval(id);
  }, [refreshMs]);

  return `${url}?v=${version}`;
}

function buildLiveData(nmea) {
  const windKnots = nmea?.wind_speed
    ? nmea.wind_speed * 1.94384
    : null;

  const pressureMb = nmea?.atmospheric_pressure
    ? nmea.atmospheric_pressure * 1000
    : null;

  const batteryVoltage =
    nmea?.battery_0_voltage ?? nmea?.battery_voltage;

  const batteryCurrent =
    nmea?.battery_0_current ?? nmea?.battery_current;

  const batteryTemp =
    nmea?.battery_0_temperature ?? nmea?.battery_temperature;

  const batteryPct = batteryVoltage
    ? Math.min(
        100,
        Math.max(
          0,
          ((Number(batteryVoltage) - 11.8) / (14.4 - 11.8)) * 100
        )
      )
    : 0;

  const sogKnots = nmea?.speed_over_ground
    ? nmea.speed_over_ground * 1.94384
    : null;

  return {
    lat: nmea?.gps_latitude ?? null,
    lon: nmea?.gps_longitude ?? null,

    latText: formatLat(nmea?.gps_latitude),
    lonText: formatLon(nmea?.gps_longitude),

    sog: formatNumber(sogKnots, 1, "0.0"),

    cog: formatNumber(
      nmea?.course_over_ground,
      0,
      "--"
    ),

    heading: formatNumber(
      nmea?.heading,
      0,
      "--"
    ),

    headingOne: formatNumber(
      nmea?.heading,
      1,
      "--"
    ),

    variation: formatNumber(
      nmea?.heading_variation,
      1,
      "--"
    ),

    windKnots: formatNumber(windKnots, 1, "--"),

    windAngle: formatNumber(
      nmea?.wind_angle,
      0,
      "--"
    ),

    windDir: degToCompass(nmea?.wind_angle),

    pressure: formatNumber(
      pressureMb,
      0,
      "--"
    ),

    water: formatTemp(nmea?.water_temperature),

    airTemp: formatTemp(
      nmea?.outside_air_temperature ??
      nmea?.air_temperature
    ),

    humidity: formatNumber(
      nmea?.relative_humidity,
      0,
      "--"
    ),

    depth: formatNumber(
      nmea?.water_depth,
      1,
      "--"
    ),

    roll: formatNumber(
      nmea?.roll,
      1,
      "0.0"
    ),

    pitch: formatNumber(
      nmea?.pitch,
      1,
      "0.0"
    ),

    yaw: formatNumber(
      nmea?.yaw ?? nmea?.heading,
      0,
      "--"
    ),

    battery: Math.round(batteryPct),

    voltage: batteryVoltage
      ? `${formatNumber(batteryVoltage, 2)} V`
      : "—",

    current: batteryCurrent
      ? `${formatNumber(batteryCurrent, 1)} A`
      : "—",

    batteryTemp: batteryTemp
      ? formatTemp(batteryTemp)
      : "—",

    remaining: "—",

    status: nmea?.last_nmea2000_update_utc
      ? "LIVE"
      : "WAITING",

    lastUpdate: nmea?.last_nmea2000_update_utc
      ? new Date(
          nmea.last_nmea2000_update_utc
        ).toLocaleTimeString()
      : "Waiting for data",

    pgnGps: nmea?.pgn_129025_count ?? "--",
    pgnWind: nmea?.pgn_130306_count ?? "--",
    pgnHeading: nmea?.pgn_127250_count ?? "--",

    currentPlace:
      nmea?.current_place?.label ?? null,
  };
}

function Header({ live }) {
  return (
    <header className="topbar">
      <div className="brand">
        <img src={WONDER_ICON} className="brand-boat" alt="Wonder" />
        <div>
          <div className="brand-title">WONDER</div>
          <div className="brand-subtitle">82' SCHOONER</div>
        </div>
      </div>

      <div className="top-metrics">
        <Metric label="LAT" value={live.latText} icon="↕" />
        <Metric label="LON" value={live.lonText} icon="⌖" />
        <Metric label="SOG" value={`${live.sog} kn`} icon="◴" />
        <Metric label="COG" value={`${live.cog}° T`} icon="↟" />
        <Metric label="TIME (EDT)" value={new Date().toLocaleTimeString()} icon="◷" />
        <Metric label="DATE" value={new Date().toLocaleDateString()} icon="▣" />
        <Metric label="STATUS" value={<span className="green-dot">● {live.status}</span>} icon="⌂" />
      </div>

      <div className="starlink">
        <div className="wifi">⌁</div>
        <div>STARLINK</div>
        <strong>Online</strong>
      </div>
    </header>
  );
}

function Metric({ label, value, icon }) {
  return (
    <div className="metric">
      <div className="metric-label">
        <span>{icon}</span>
        {label}
      </div>
      <div className="metric-value">{value}</div>
    </div>
  );
}

function CameraPanel({ title, url, refreshMs }) {
  const src = useRefreshingImage(url, refreshMs);
  const [loadedAt, setLoadedAt] = useState(null);
  const [hasError, setHasError] = useState(false);

  return (
    <section className="camera-panel">
      {!hasError ? (
        <img
          src={src}
          className="camera-image"
          alt={`${title} latest still`}
          onLoad={() => {
            setLoadedAt(new Date());
            setHasError(false);
          }}
          onError={() => setHasError(true)}
        />
      ) : (
        <div className="camera-placeholder">
          <div className="camera-error">Image unavailable<br />Check R2 public URL</div>
        </div>
      )}

      <div className="live-chip">
        {title} <span /> LIVE
      </div>

      <div className="camera-stamp">
        {Math.round(refreshMs / 1000)}s refresh
        {loadedAt ? ` · ${loadedAt.toLocaleTimeString()}` : ""}
      </div>

      <button className="expand-button">⛶</button>
    </section>
  );
}

function VoyageMap({ route, liveTrack, progress, setProgress, mapMode, setMapMode, live }) {
  const mapRef = useRef(null);
  const mapEl = useRef(null);
  const routeLayersRef = useRef({});
  const boatMarkerRef = useRef(null);
  const lastPointRef = useRef(null);

  // For now, display only the cleaned historic route from public/voyage-route.json.
  // PiCAN live GPS still controls the boat marker, and Render can still keep logging
  // new liveTrack points in the background. We are just not drawing liveTrack yet.
  const points = useMemo(() => {
    return route?.points?.map((p) => [p.lat, p.lon]) || [];
  }, [route]);

  const replayPoint = useMemo(() => {
    if (!points.length) return null;
    const index = Math.min(
      points.length - 1,
      Math.floor(progress * (points.length - 1))
    );
    return points[index];
  }, [points, progress]);

  const livePoint = useMemo(() => {
    if (live.lat && live.lon) return [live.lat, live.lon];
    return null;
  }, [live.lat, live.lon]);

  const currentPoint = mapMode === "live"
    ? livePoint || replayPoint
    : replayPoint;
  
  const liveDistanceNm = useMemo(() => {
    return calculateRouteDistanceNm(points);
  }, [points]);

  function handleSliderChange(e) {
    setProgress(Number(e.target.value));
    setMapMode("replay");
  }

  function handlePlayLive() {
    setMapMode("live");
    setProgress(0.98);

    if (mapRef.current && livePoint) {
      mapRef.current.flyTo(livePoint, Math.max(mapRef.current.getZoom(), 8), {
        duration: 1.2,
      });
    }
  }

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;

    mapRef.current = L.map(mapEl.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([29.5, -80.1], 6);

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 18 }
    ).addTo(mapRef.current);

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png",
      { maxZoom: 18 }
    ).addTo(mapRef.current);

    L.control.zoom({ position: "topright" }).addTo(mapRef.current);
  }, []);

  useEffect(() => {
    if (!mapRef.current || !points.length) return;

    const map = mapRef.current;

    Object.values(routeLayersRef.current).forEach((layer) => {
      if (layer && map.hasLayer(layer)) map.removeLayer(layer);
    });

    routeLayersRef.current = {};

    routeLayersRef.current.routeGlow = L.polyline(points, {
      color: "#ffffff",
      weight: 10,
      opacity: 0.2,
    }).addTo(map);

    routeLayersRef.current.fullRoute = L.polyline(points, {
      color: "#67e8f9",
      weight: 3,
      opacity: 0.55,
      dashArray: "5, 12",
    }).addTo(map);

    routeLayersRef.current.start = L.circleMarker(points[0], {
      radius: 7,
      color: "#fff",
      weight: 2,
      fillColor: "#22c55e",
      fillOpacity: 1,
    }).addTo(map).bindTooltip("Key West, FL");

    routeLayersRef.current.end = L.circleMarker(points[points.length - 1], {
      radius: 7,
      color: "#fff",
      weight: 2,
      fillColor: "#ef4444",
      fillOpacity: 1,
    }).addTo(map).bindTooltip("Charleston, SC");

    if (!map._oceanPiFitDone) {
      map.fitBounds(L.latLngBounds(points), { padding: [30, 30] });
      map._oceanPiFitDone = true;
    }
  }, [points]);

  useEffect(() => {
    if (!mapRef.current || !points.length || !currentPoint) return;

    const map = mapRef.current;
    const routeIndex = nearestPointIndex(points, currentPoint);
    const traveled = points.slice(0, routeIndex + 1);
    const remaining = points.slice(routeIndex);

    if (routeLayersRef.current.traveled && map.hasLayer(routeLayersRef.current.traveled)) {
      routeLayersRef.current.traveled.setLatLngs(traveled);
    } else {
      routeLayersRef.current.traveled = L.polyline(traveled, {
        color: "#ff3158",
        weight: 5,
        opacity: 0.98,
      }).addTo(map);
    }

    if (routeLayersRef.current.fullRoute && map.hasLayer(routeLayersRef.current.fullRoute)) {
      routeLayersRef.current.fullRoute.setLatLngs(remaining);
    }

    if (!boatMarkerRef.current) {
      const icon = L.divIcon({
        html: `<div class="boat-marker"><img src="${WONDER_TOPDOWN}" /></div>`,
        className: "",
        iconSize: [86, 60],
        iconAnchor: [43, 30],
      });

      boatMarkerRef.current = L.marker(currentPoint, { icon }).addTo(map);
      lastPointRef.current = currentPoint;
      return;
    }

    const previous = lastPointRef.current;
    const shouldMove = !previous || distanceMeters(previous, currentPoint) > 2;

    if (shouldMove) {
      smoothMoveMarker(boatMarkerRef.current, previous || currentPoint, currentPoint, 850);
      lastPointRef.current = currentPoint;
    }
  }, [points, currentPoint, mapMode]);

  return (
    <section className="map-card">
      <div className="map-el" ref={mapEl} />
      <div className="map-vignette" />

      <div className="weather-badge">
        <span>☀</span>
        <strong>{live.airTemp !== "--" ? live.airTemp : "Live"}</strong>
        <small>{live.windDir} {live.windKnots} kn</small>
      </div>

      <div className="voyage-summary">
        <h3>VOYAGE SUMMARY</h3>
        <SummaryRow label="From" value="Key West, FL" />
        <SummaryRow label="To" value={live.currentPlace || "Current area"}/>
        <SummaryRow label="Start" value="May 3, 2026" />
        <SummaryRow label="Distance" value={`${liveDistanceNm.toFixed(1)} NM`} />
        <SummaryRow
          label="Map Mode"
          value={
            mapMode === "live"
              ? <span className="green-dot">LIVE</span>
              : <span style={{ color: "#facc15" }}>REPLAY</span>
          }
        />
      </div>

      <div className="map-tabs">
        <button
          className={mapMode === "live" ? "active" : ""}
          onClick={handlePlayLive}
        >
          LIVE
        </button>
        <button
          className={mapMode === "replay" ? "active" : ""}
          onClick={() => setMapMode("replay")}
        >
          REPLAY
        </button>
        <button className="active">SATELLITE</button>
      </div>

      <div className="timeline">
        <button className="play" onClick={handlePlayLive}>▶</button>
        <div className="timeline-label">
          <strong>{mapMode === "live" ? "LIVE POSITION" : "VOYAGE REPLAY"}</strong>
          <span>{mapMode === "live" ? "Wonder current location" : "Key West → Charleston"}</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.001"
          value={progress}
          onChange={handleSliderChange}
        />
        <div className="timeline-date">
          {mapMode === "live" ? "Live stream" : "Replay mode"} ·{" "}
          <span>{mapMode === "live" ? "LIVE" : "REPLAY"}</span>
        </div>
      </div>
    </section>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="summary-row">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function MotionPanel({ live }) {
  const roll = parseSafeNumber(live.roll, 0);
  const pitch = parseSafeNumber(live.pitch, 0);
  const yaw = parseSafeNumber(live.yaw, 0);

  const yawTilt = Number.isFinite(yaw)
    ? Math.max(-10, Math.min(10, ((yaw % 360) - 180) / 18))
    : 0;

  return (
    <Panel title="VESSEL MOTION" className="motion-panel">
      <div className="motion-grid">
        <div className="ship-stage">
          <img
            src={WONDER_ICON}
            className="motion-ship"
            alt="Wonder motion"
            style={{
              transform: `
                translate(-50%, -50%)
                perspective(800px)
                rotateZ(${roll}deg)
                rotateX(${-pitch}deg)
                rotateY(${yawTilt}deg)
              `,
              transition: "transform 700ms ease-out",
            }}
          />
          <div className="stage-glow" />
        </div>
        <div className="motion-readouts">
          <Readout label="ROLL" value={`${live.roll}°`} />
          <Readout label="PITCH" value={`${live.pitch}°`} />
          <Readout label="YAW" value={`${live.yaw}° T`} />
        </div>
      </div>

      <div className="heading-wind">
        <div>
          <span>HEADING</span>
          <div className="heading-dial">
            {live.heading}°<small>T</small>
          </div>
        </div>
        <div>
          <span>WIND RELATIVE</span>
          <strong>{live.windKnots} kn</strong>
          <b>{live.windDir} ➤</b>
        </div>
      </div>
    </Panel>
  );
}

function Readout({ label, value }) {
  return (
    <div className="readout">
      <span>{label}</span>
      <strong>{value}</strong>
      <i>○</i>
    </div>
  );
}

function Panel({ title, children, className = "" }) {
  return (
    <section className={`panel ${className}`}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function VesselSystems({ live }) {
  const items = [
    ["SOG", `${live.sog} kn`, "◴"],
    ["COG", `${live.cog}° T`, "Ⓐ"],
    ["HDG", `${live.heading}° T`, "◷"],
    ["DEPTH", live.depth !== "--" ? `${live.depth} ft` : "—", "≋"],
    ["WATER", live.water, "♨"],
    ["AWA", `${live.windAngle}°`, "⋈"],
    ["AWS", `${live.windKnots} kn`, "☼"],
    ["GPS", live.latText, "⌖"],
  ];

  return (
    <Panel title="VESSEL SYSTEMS">
      <div className="systems-grid">
        {items.map(([label, value, icon]) => (
          <div key={label}>
            <span>{icon}</span>
            <small>{label}</small>
            <b>{value}</b>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function BatteryPanel({ live }) {
  return (
    <Panel title="BATTERY SYSTEM">
      <div className="battery-grid">
        <div className="battery-ring" style={{ "--pct": `${live.battery * 3.6}deg` }}>
          <div>
            <strong>{live.battery}%</strong>
            <span>SOC</span>
          </div>
        </div>

        <div className="battery-details">
          <Detail label="Voltage" value={live.voltage} />
          <Detail label="Current" value={live.current} />
          <Detail label="Remaining" value={live.remaining} />
          <Detail label="Status" value={<span className="green-dot">● Awaiting battery PGN</span>} />
          <div className="sparkline" />
        </div>
      </div>
    </Panel>
  );
}

function EnvironmentPanel({ live }) {
  return (
    <Panel title="NMEA2000 WEATHER STATION">
      <div className="env-grid">
        <Detail label="Air Temp" value={live.airTemp} />
        <Detail label="Wind Speed" value={`${live.windKnots} kn`} />
        <Detail label="Pressure" value={`${live.pressure} hPa`} />
        <Detail label="Wind Dir" value={live.windDir} />
        <Detail label="Humidity" value={live.humidity !== "--" ? `${live.humidity}%` : "—"} />
        <Detail label="Wind Angle" value={`${live.windAngle}°`} />
      </div>

      <div className="imu-row">
        <span>PGN</span>
        <b>GPS {live.pgnGps}</b>
        <b>Wind {live.pgnWind}</b>
        <b>HDG {live.pgnHeading}</b>
      </div>
    </Panel>
  );
}

function Detail({ label, value }) {
  return (
    <div className="detail">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function Footer({ live }) {
  return (
    <footer className="footer">
      <div>
        ⚙ Last updated: <b>{live.lastUpdate}</b>
        <span className="green-dot">● Live</span>
      </div>

      <nav>
        <span>▣ CAMERAS</span>
        <span className="active">◇ MAP</span>
        <span>◎ TELEMETRY</span>
        <span>▤ VOYAGE LOG</span>
        <span>△ ALARMS</span>
      </nav>

      <div className="footer-brand">≋ OCEAN<span>PI</span></div>
    </footer>
  );
}

function smoothMoveMarker(marker, from, to, durationMs = 850) {
  if (!marker || !from || !to) return;

  const start = performance.now();

  function step(now) {
    const elapsed = now - start;
    const t = Math.min(1, elapsed / durationMs);
    const eased = easeInOutCubic(t);

    const lat = from[0] + (to[0] - from[0]) * eased;
    const lon = from[1] + (to[1] - from[1]) * eased;

    marker.setLatLng([lat, lon]);

    if (t < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function distanceMeters(a, b) {
  if (!a || !b) return Infinity;

  const R = 6371000;
  const lat1 = toRadians(a[0]);
  const lat2 = toRadians(b[0]);
  const dLat = toRadians(b[0] - a[0]);
  const dLon = toRadians(b[1] - a[1]);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}

function toRadians(deg) {
  return deg * Math.PI / 180;
}

function formatNumber(value, digits = 1, fallback = "--") {
  if (value === null || value === undefined || value === "") return fallback;
  const num = Number(value);
  if (Number.isNaN(num)) return fallback;
  return num.toFixed(digits);
}

function parseSafeNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function formatTemp(value) {
  if (value === null || value === undefined || value === "") return "—";
  let num = Number(value);
  if (Number.isNaN(num)) return "—";

  if (num > 100) num = num - 273.15;
  if (num < 60) num = num * 9 / 5 + 32;

  return `${num.toFixed(1)} °F`;
}

function formatLat(lat) {
  if (lat === null || lat === undefined) return "--";
  const abs = Math.abs(Number(lat));
  const deg = Math.floor(abs);
  const min = ((abs - deg) * 60).toFixed(3);
  return `${deg}°${min}' ${Number(lat) >= 0 ? "N" : "S"}`;
}

function formatLon(lon) {
  if (lon === null || lon === undefined) return "--";
  const abs = Math.abs(Number(lon));
  const deg = Math.floor(abs);
  const min = ((abs - deg) * 60).toFixed(3);
  return `${deg}°${min}' ${Number(lon) >= 0 ? "E" : "W"}`;
}

function calculateRouteDistanceNm(points) {
  if (!points || points.length < 2) return 0;

  let meters = 0;

  for (let i = 1; i < points.length; i++) {
    meters += distanceMeters(points[i - 1], points[i]);
  }

  return meters / 1852;
}

function degToCompass(deg) {
  if (deg === null || deg === undefined || Number.isNaN(Number(deg))) return "--";
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(Number(deg) / 22.5) % 16];
}

function nearestPointIndex(points, point) {
  if (!points.length || !point) return 0;

  let bestIndex = 0;
  let bestDistance = Infinity;

  for (let i = 0; i < points.length; i += 1) {
    const dLat = points[i][0] - point[0];
    const dLon = points[i][1] - point[1];
    const d = dLat * dLat + dLon * dLon;

    if (d < bestDistance) {
      bestDistance = d;
      bestIndex = i;
    }
  }

  return bestIndex;
}

export default App;