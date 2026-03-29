import { useEffect, useMemo, useState } from "react";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";


const API_BASE_URL = "http://localhost:8000";
const TIGER_TRACTS_URL = "http://localhost:8000/tracts/geojson";

const badgeClasses = {
  low: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  medium: "bg-amber-100 text-amber-800 ring-amber-200",
  high: "bg-orange-100 text-orange-800 ring-orange-200",
  critical: "bg-red-100 text-red-800 ring-red-200",
};

const mapFillColors = {
  low: "#22c55e",
  medium: "#facc15",
  high: "#f97316",
  critical: "#ef4444",
};

function parseSearchInput(value) {
  const trimmed = value.trim();
  const digitsOnly = trimmed.replace(/\D/g, "");

  if (digitsOnly.length === 11) {
    return { type: "tract", geoid: digitsOnly };
  }

  if (digitsOnly.length === 5) {
    return { type: "zip", zipcode: digitsOnly };
  }

  return null;
}

function formatPercent(value) {
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function formatShapValue(value) {
  const numericValue = Number(value);
  const arrow = numericValue >= 0 ? "\u2191" : "\u2193";
  const tone = numericValue >= 0 ? "text-red-600" : "text-emerald-600";
  return {
    arrow,
    tone,
    text: `${arrow} ${Math.abs(numericValue).toFixed(3)}`,
  };
}

async function fetchStateTractsGeoJson(stateFips, geoids) {
  const params = new URLSearchParams({ geoids: geoids.join(",") });
  const response = await fetch(`${TIGER_TRACTS_URL}/${stateFips}?${params.toString()}`);
  if (!response.ok) throw new Error(`Failed to load tract boundaries.`);
  return response.json();
}

function MapBounds({ geoJson }) {
  const map = useMap();

  useEffect(() => {
    const features = geoJson?.features ?? [];
    if (!features.length) {
      return;
    }

    const bounds = [];
    features.forEach((feature) => {
      const coordinates = feature?.geometry?.coordinates ?? [];
      const geometryType = feature?.geometry?.type;

      const walkCoordinates = (nodes) => {
        if (!Array.isArray(nodes)) {
          return;
        }

        if (typeof nodes[0] === "number" && typeof nodes[1] === "number") {
          bounds.push([nodes[1], nodes[0]]);
          return;
        }

        nodes.forEach(walkCoordinates);
      };

      if (geometryType === "Polygon" || geometryType === "MultiPolygon") {
        walkCoordinates(coordinates);
      }
    });

    if (bounds.length) {
      map.fitBounds(bounds, { padding: [24, 24] });
    }
  }, [geoJson, map]);

  return null;
}

function ZipResultsMap({ tracts, tractGeoJson, mapError, mapLoading }) {
  if (mapLoading) {
    return (
      <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
        <p className="text-sm text-slate-600">Loading tract boundaries for this ZIP code...</p>
      </section>
    );
  }

  if (mapError) {
    return (
      <section className="mt-6 rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        {mapError}
      </section>
    );
  }

  if (!tractGeoJson?.features?.length) {
    return null;
  }

  const tractByGeoid = new Map(tracts.map((tract) => [tract.GEOID, tract]));

  const geoJsonStyle = (feature) => {
    const geoid = feature?.properties?.GEOID;
    const tract = tractByGeoid.get(geoid);
    const tier = tract?.risk_tier ?? "low";

    return {
      color: "#0f172a",
      weight: 1,
      fillColor: mapFillColors[tier] ?? mapFillColors.low,
      fillOpacity: 0.58,
    };
  };

  const onEachFeature = (feature, layer) => {
    const geoid = feature?.properties?.GEOID;
    const tract = tractByGeoid.get(geoid);
    if (!tract) {
      return;
    }

    const topFactor = tract.top_driving_factors?.[0];
    layer.bindPopup(`
      <div style="min-width: 220px;">
        <div style="font-weight: 700; margin-bottom: 4px;">${tract.GEOID}</div>
        <div>Risk score: ${formatPercent(tract.predicted_risk_score)}</div>
        <div>Risk tier: ${tract.risk_tier}</div>
        <div style="margin-top: 8px;">Top driver: ${topFactor?.label ?? "N/A"}</div>
      </div>
    `);
  };

  return (
    <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
      <div className="mb-4 px-2 pt-2">
        <h2 className="text-lg font-semibold text-slate-900">ZIP-level tract map</h2>
        <p className="mt-1 text-sm text-slate-600">
          Census tract boundaries are shaded by RootScore risk tier. Click a tract to see details.
        </p>
      </div>
      <div className="h-[34rem] overflow-hidden rounded-3xl">
        <MapContainer center={[37.8, -96]} zoom={4} scrollWheelZoom className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <GeoJSON data={tractGeoJson} style={geoJsonStyle} onEachFeature={onEachFeature} />
          <MapBounds geoJson={tractGeoJson} />
        </MapContainer>
      </div>
    </section>
  );
}

function ResultCard({ tract, zip }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/60">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Census Tract
          </p>
          {zip ? (
            <p className="mt-1 text-xs text-slate-400">ZIP {zip}</p>
          ) : null}
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">{tract.GEOID}</h2>
        </div>

        <div className="flex flex-col items-start gap-3 sm:items-end">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold capitalize ring-1 ${badgeClasses[tract.risk_tier] ?? badgeClasses.low}`}
          >
            {tract.risk_tier}
          </span>
          <div className="text-left sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Risk Score
            </p>
            <p className="mt-1 text-3xl font-bold text-slate-900">
              {formatPercent(tract.predicted_risk_score)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-sm font-semibold text-slate-900">Top driving factors</p>
        <ul className="mt-3 space-y-3">
          {tract.top_driving_factors?.map((factor) => {
            const shap = formatShapValue(factor.shap_value ?? 0);
            return (
              <li
                key={`${tract.GEOID}-${factor.feature}`}
                className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-slate-900">{factor.label}</p>
                  <p className="text-sm text-slate-500">
                    {Number(factor.shap_value) >= 0
                      ? "Associated with higher risk"
                      : "Associated with lower risk"}
                  </p>
                </div>
                <span className={`text-sm font-semibold ${shap.tone}`}>{shap.text}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </article>
  );
}

export default function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searchContext, setSearchContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchMode, setSearchMode] = useState("");
  const [searchedZip, setSearchedZip] = useState("");
  const [tractGeoJson, setTractGeoJson] = useState(null);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState("");

  const zipResultStateFips = useMemo(() => {
    if (searchMode !== "zip" || results.length === 0) {
      return [];
    }
    return [...new Set(results.map((tract) => String(tract.GEOID).slice(0, 2)))];
  }, [results, searchMode]);

  useEffect(() => {
    async function loadMapData() {
      if (searchMode !== "zip" || results.length === 0 || zipResultStateFips.length === 0) {
        setTractGeoJson(null);
        setMapError("");
        return;
      }

      setMapLoading(true);
      setMapError("");

      try {
        const geoJsonResponses = await Promise.all(
          zipResultStateFips.map((stateFips) => {
            const stateGeoids = results
              .filter((t) => t.GEOID.startsWith(stateFips))
              .map((t) => t.GEOID);
            return fetchStateTractsGeoJson(stateFips, stateGeoids);
          })
        );

        const tractGeoids = new Set(results.map((tract) => tract.GEOID));
        const mergedFeatures = geoJsonResponses
          .flatMap((geoJson) => geoJson.features ?? [])
          .filter((feature) => tractGeoids.has(feature?.properties?.GEOID));

        setTractGeoJson({
          type: "FeatureCollection",
          features: mergedFeatures,
        });
      } catch (mapLoadError) {
        setTractGeoJson(null);
        setMapError(mapLoadError.message || "Unable to load map boundaries.");
      } finally {
        setMapLoading(false);
      }
    }

    loadMapData();
  }, [results, searchMode, zipResultStateFips]);

  async function handleSearch(event) {
    event.preventDefault();
    setError("");
    setResults([]);
    setTractGeoJson(null);
    setMapError("");
    setSearchedZip("");

    const parsed = parseSearchInput(query);
    if (!parsed) {
      setError("Enter either an 11-digit tract GEOID or a 5-digit ZIP code.");
      return;
    }

    setLoading(true);

    try {
      if (parsed.type === "tract") {
        const response = await fetch(`${API_BASE_URL}/tract/${parsed.geoid}`);
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.detail || "Unable to load tract data.");
        }

        setResults([payload]);
        setSearchContext(`Showing RootScore for tract ${payload.GEOID}`);
        setSearchMode("tract");
        setSearchedZip("");
      } else {
        const response = await fetch(`${API_BASE_URL}/zip/${parsed.zipcode}`);
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.detail || "Unable to load ZIP code data.");
        }

        setResults(payload.tracts || []);
        setSearchContext(`Showing ${payload.tract_count} tracts for ZIP ${payload.zip}`);
        setSearchMode("zip");
        setSearchedZip(parsed.zipcode);
      }
    } catch (searchError) {
      setError(searchError.message || "Something went wrong while searching.");
      setSearchMode("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.14),_transparent_38%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-12 sm:px-8 lg:px-10">
        <header className="rounded-[2rem] border border-white/70 bg-white/80 px-8 py-10 shadow-xl shadow-slate-200/50 backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-teal-700">
            RootScore
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            Know before displacement happens.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Search by census tract GEOID or ZIP code to surface eviction risk,
            neighborhood vulnerability, and the strongest drivers behind each score.
          </p>

          <form onSubmit={handleSearch} className="mt-8 flex flex-col gap-4 lg:flex-row">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Enter tract GEOID or ZIP code"
              className="h-14 flex-1 rounded-2xl border border-slate-200 bg-white px-5 text-base text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-teal-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-14 items-center justify-center rounded-2xl bg-slate-950 px-6 text-base font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {loading ? "Searching..." : "Search RootScore"}
            </button>
          </form>

          <p className="mt-3 text-sm text-slate-500">
            Examples: <span className="font-medium text-slate-700">17031010100</span> or{" "}
            <span className="font-medium text-slate-700">78229</span>
          </p>
        </header>

        <main className="mt-8">
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {searchContext ? (
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-600">{searchContext}</p>
              {results.length > 0 ? (
                <p className="text-sm text-slate-500">{results.length} result(s)</p>
              ) : null}
            </div>
          ) : null}

          {searchMode === "zip" && results.length > 0 ? (
            <ZipResultsMap
              tracts={results}
              tractGeoJson={tractGeoJson}
              mapError={mapError}
              mapLoading={mapLoading}
            />
          ) : null}

          {results.length > 0 ? (
            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              {results.map((tract) => (
                <ResultCard key={tract.GEOID} tract={tract} zip={searchedZip} />
              ))}
            </div>
          ) : !loading ? (
            <section className="rounded-[2rem] border border-dashed border-slate-300 bg-white/60 px-8 py-16 text-center">
              <h2 className="text-xl font-semibold text-slate-900">Search a tract or ZIP code to begin</h2>
              <p className="mt-3 text-slate-600">
                RootScore returns tract-level eviction risk predictions with a transparent
                breakdown of the factors pushing risk up or down.
              </p>
            </section>
          ) : null}
        </main>

        <footer className="mt-10 rounded-[2rem] border border-white/70 bg-white/70 px-8 py-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm leading-7 text-slate-500">
            RootScore is designed for intervention, not surveillance. Scores are advisory and
            reflect neighborhood-level patterns, not individual circumstances. Data sources:
            Census ACS, Eviction Lab, CDC PLACES.
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-500">
            Eviction data reflects 2016 validated records. Model trained on XGBoost with AUC-ROC 0.81.
          </p>
          <a
            href="https://github.com/timothytroyhollis-ctrl/RootScore"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex text-sm font-medium text-teal-700 transition hover:text-teal-800"
          >
            View the GitHub repository →
          </a>
        </footer>

      </div>
    </div>
  );
}
