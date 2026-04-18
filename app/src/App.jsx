import { useEffect, useMemo, useState } from "react";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";


const API_BASE_URL = "https://rootscore-api.onrender.com";
const TIGER_TRACTS_URL = "https://rootscore-api.onrender.com/tracts/geojson";

const badgeClasses = {
  low: "bg-emerald-900/80 text-emerald-200 ring-emerald-700",
  medium: "bg-amber-900/80 text-amber-200 ring-amber-700",
  high: "bg-orange-900/80 text-orange-200 ring-orange-700",
  critical: "bg-red-900/80 text-red-200 ring-red-700",
};

const badgeStyles = {
  low: { backgroundColor: "rgba(6, 78, 59, 0.88)", color: "#a7f3d0", borderColor: "#047857" },
  medium: { backgroundColor: "rgba(120, 53, 15, 0.88)", color: "#fde68a", borderColor: "#b45309" },
  high: { backgroundColor: "rgba(124, 45, 18, 0.88)", color: "#fdba74", borderColor: "#c2410c" },
  critical: { backgroundColor: "rgba(127, 29, 29, 0.88)", color: "#fca5a5", borderColor: "#b91c1c" },
};

const mapFillColors = {
  low: "#22c55e",
  medium: "#facc15",
  high: "#f97316",
  critical: "#ef4444",
};

const dimensionLabels = {
  housing_stability_score: "Housing Stability",
  walk_score: "Walkability",
  transit_score: "Transit",
  education_score: "Education",
  affordability_score: "Affordability",
};

const dimensionTooltips = {
  housing_stability_score:
    "Based on eviction filing rates, rent burden, renter occupancy, and unemployment data from Census ACS and Princeton Eviction Lab.",
  walk_score:
    "Based on Walk Score city-level averages reflecting pedestrian friendliness of the neighborhood.",
  transit_score:
    "Based on transit score reflecting access to public transportation options.",
  education_score:
    "Based on educational attainment percentage from Census ACS 5-Year Estimates.",
  affordability_score:
    "Based on HUD Fair Market Rent for a 2-bedroom unit, inverted so lower rent areas score higher.",
};

const stateOptions = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN",
  "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
  "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT",
  "VT", "VA", "WA", "WV", "WI", "WY",
];

const weightConfig = [
  { key: "housing", label: "Housing Stability" },
  { key: "walk", label: "Walkability" },
  { key: "transit", label: "Transit" },
  { key: "education", label: "Education" },
  { key: "affordability", label: "Affordability" },
  { key: "lgbt", label: "LGBT Policy" },
];

const stateInfoByFips = {
  "01": { abbr: "AL", name: "Alabama" },
  "02": { abbr: "AK", name: "Alaska" },
  "04": { abbr: "AZ", name: "Arizona" },
  "05": { abbr: "AR", name: "Arkansas" },
  "06": { abbr: "CA", name: "California" },
  "08": { abbr: "CO", name: "Colorado" },
  "09": { abbr: "CT", name: "Connecticut" },
  "10": { abbr: "DE", name: "Delaware" },
  "11": { abbr: "DC", name: "District of Columbia" },
  "12": { abbr: "FL", name: "Florida" },
  "13": { abbr: "GA", name: "Georgia" },
  "15": { abbr: "HI", name: "Hawaii" },
  "16": { abbr: "ID", name: "Idaho" },
  "17": { abbr: "IL", name: "Illinois" },
  "18": { abbr: "IN", name: "Indiana" },
  "19": { abbr: "IA", name: "Iowa" },
  "20": { abbr: "KS", name: "Kansas" },
  "21": { abbr: "KY", name: "Kentucky" },
  "22": { abbr: "LA", name: "Louisiana" },
  "23": { abbr: "ME", name: "Maine" },
  "24": { abbr: "MD", name: "Maryland" },
  "25": { abbr: "MA", name: "Massachusetts" },
  "26": { abbr: "MI", name: "Michigan" },
  "27": { abbr: "MN", name: "Minnesota" },
  "28": { abbr: "MS", name: "Mississippi" },
  "29": { abbr: "MO", name: "Missouri" },
  "30": { abbr: "MT", name: "Montana" },
  "31": { abbr: "NE", name: "Nebraska" },
  "32": { abbr: "NV", name: "Nevada" },
  "33": { abbr: "NH", name: "New Hampshire" },
  "34": { abbr: "NJ", name: "New Jersey" },
  "35": { abbr: "NM", name: "New Mexico" },
  "36": { abbr: "NY", name: "New York" },
  "37": { abbr: "NC", name: "North Carolina" },
  "38": { abbr: "ND", name: "North Dakota" },
  "39": { abbr: "OH", name: "Ohio" },
  "40": { abbr: "OK", name: "Oklahoma" },
  "41": { abbr: "OR", name: "Oregon" },
  "42": { abbr: "PA", name: "Pennsylvania" },
  "44": { abbr: "RI", name: "Rhode Island" },
  "45": { abbr: "SC", name: "South Carolina" },
  "46": { abbr: "SD", name: "South Dakota" },
  "47": { abbr: "TN", name: "Tennessee" },
  "48": { abbr: "TX", name: "Texas" },
  "49": { abbr: "UT", name: "Utah" },
  "50": { abbr: "VT", name: "Vermont" },
  "51": { abbr: "VA", name: "Virginia" },
  "53": { abbr: "WA", name: "Washington" },
  "54": { abbr: "WV", name: "West Virginia" },
  "55": { abbr: "WI", name: "Wisconsin" },
  "56": { abbr: "WY", name: "Wyoming" },
};

const stateInfoByAbbr = Object.fromEntries(
  Object.values(stateInfoByFips).map((stateInfo) => [stateInfo.abbr, stateInfo])
);

function parseSearchInput(value) {
  const trimmed = value.trim();
  const digitsOnly = trimmed.replace(/\D/g, "");
  if (digitsOnly.length === 11) return { type: "tract", geoid: digitsOnly };
  if (digitsOnly.length === 5) return { type: "zip", zipcode: digitsOnly };
  return null;
}

function formatPercent(value) {
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function formatScore(value) {
  return Math.round(Number(value) || 0);
}

function scoreTone(value) {
  const numericValue = Number(value) || 0;
  if (numericValue < 40) {
    return { text: "text-white", fill: "bg-blue-400", panel: "from-blue-50 to-white", ring: "ring-blue-200" };
  }
  if (numericValue <= 60) {
    return { text: "text-white", fill: "bg-blue-500", panel: "from-blue-50 to-white", ring: "ring-blue-200" };
  }
  return { text: "text-white", fill: "bg-blue-600", panel: "from-blue-50 to-white", ring: "ring-blue-200" };
}

function formatShapValue(value) {
  const numericValue = Number(value);
  const arrow = numericValue >= 0 ? "\u2191" : "\u2193";
  const tone = numericValue >= 0 ? "text-red-600" : "text-emerald-600";
  return { arrow, tone, text: `${arrow} ${Math.abs(numericValue).toFixed(3)}` };
}

function rebalanceWeights(currentWeights, changedKey, nextValue) {
  const clampedValue = Math.max(0, Math.min(100, Number(nextValue) || 0));
  const otherKeys = weightConfig.map((item) => item.key).filter((key) => key !== changedKey);
  const remaining = 100 - clampedValue;
  const currentOtherTotal = otherKeys.reduce((sum, key) => sum + currentWeights[key], 0);
  const updatedWeights = { ...currentWeights, [changedKey]: clampedValue };

  if (otherKeys.length === 0) return updatedWeights;

  if (currentOtherTotal <= 0) {
    const baseShare = Math.floor(remaining / otherKeys.length);
    let remainder = remaining - baseShare * otherKeys.length;
    otherKeys.forEach((key) => {
      updatedWeights[key] = baseShare + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
    });
    return updatedWeights;
  }

  const rawAllocations = otherKeys.map((key) => ({
    key,
    value: (currentWeights[key] / currentOtherTotal) * remaining,
  }));

  let assigned = 0;
  rawAllocations.forEach((item) => {
    updatedWeights[item.key] = Math.floor(item.value);
    assigned += updatedWeights[item.key];
  });

  let remainder = remaining - assigned;
  rawAllocations
    .sort((a, b) => (b.value - Math.floor(b.value)) - (a.value - Math.floor(a.value)))
    .forEach((item) => {
      if (remainder > 0) { updatedWeights[item.key] += 1; remainder -= 1; }
    });

  return updatedWeights;
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
    if (!features.length) return;
    const bounds = [];
    features.forEach((feature) => {
      const coordinates = feature?.geometry?.coordinates ?? [];
      const geometryType = feature?.geometry?.type;
      const walkCoordinates = (nodes) => {
        if (!Array.isArray(nodes)) return;
        if (typeof nodes[0] === "number" && typeof nodes[1] === "number") {
          bounds.push([nodes[1], nodes[0]]);
          return;
        }
        nodes.forEach(walkCoordinates);
      };
      if (geometryType === "Polygon" || geometryType === "MultiPolygon") walkCoordinates(coordinates);
    });
    if (bounds.length) map.fitBounds(bounds, { padding: [24, 24] });
  }, [geoJson, map]);
  return null;
}

function ZipResultsMap({ tracts, tractGeoJson, mapError, mapLoading }) {
  if (mapLoading) {
    return (
      <section className="mt-6 rounded-[2rem] border border-white/30 bg-black/40 p-6 shadow-sm shadow-slate-200/50 backdrop-blur-lg">
        <p className="text-sm font-semibold text-white">Loading tract boundaries for this ZIP code...</p>
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
  if (!tractGeoJson?.features?.length) return null;

  const tractByGeoid = new Map(tracts.map((tract) => [tract.GEOID, tract]));

  const geoJsonStyle = (feature) => {
    const geoid = feature?.properties?.GEOID;
    const tract = tractByGeoid.get(geoid);
    const tier = tract?.risk_tier ?? "low";
    return { color: "#0f172a", weight: 1, fillColor: mapFillColors[tier] ?? mapFillColors.low, fillOpacity: 0.58 };
  };

  const onEachFeature = (feature, layer) => {
    const geoid = feature?.properties?.GEOID;
    const tract = tractByGeoid.get(geoid);
    if (!tract) return;
    const topFactor = tract.top_driving_factors?.[0];
    layer.bindPopup(`
      <div style="min-width: 220px;">
        <div style="font-weight: 700; margin-bottom: 4px;">${tract.GEOID}</div>
        <div>QRoots Score: ${formatScore(tract.qroots_score)}/100</div>
        <div>Risk tier: ${tract.risk_tier}</div>
        <div style="margin-top: 8px;">Top driver: ${topFactor?.label ?? "N/A"}</div>
      </div>
    `);
  };

  return (
    <section className="mt-6 rounded-[2rem] border border-white/30 bg-black/40 p-4 shadow-sm shadow-slate-200/50 backdrop-blur-lg">
      <div className="mb-4 px-2 pt-2">
        <h2 className="text-white text-lg font-semibold">ZIP-level tract map</h2>
        <p className="mt-1 text-white font-semibold text-sm">
          Census tract boundaries are shaded by housing stability tier. Click a tract to see details.
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

function DimensionBar({ label, value }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  const tone = scoreTone(safeValue);
  const tooltipKey = Object.entries(dimensionLabels).find(([, dimensionLabel]) => dimensionLabel === label)?.[0];
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="group relative inline-flex items-center">
          <p className="cursor-help text-sm font-semibold text-white underline decoration-dotted underline-offset-4">
            {label}
          </p>
          <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden w-72 rounded-2xl bg-slate-950 px-4 py-3 text-xs leading-5 text-white shadow-xl group-hover:block">
            {dimensionTooltips[tooltipKey] ?? ""}
          </div>
        </div>
        <p className={`text-sm font-semibold ${tone.text}`}>{formatScore(safeValue)}/100</p>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone.fill}`} style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
}

function MiniDimensionBar({ label, value }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  const tone = scoreTone(safeValue);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-semibold text-white">{label}</p>
        <p className={`text-xs font-semibold ${tone.text}`}>{formatScore(safeValue)}</p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone.fill}`} style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
}

function NeighborhoodSummaryCard({ summary, loading }) {
  return (
    <section className="mb-6 rounded-[2rem] border border-white/30 bg-black/40 p-6 shadow-sm shadow-slate-200/50 backdrop-blur-lg">
      <p className="text-white text-sm font-semibold uppercase tracking-[0.28em]">
        AI Neighborhood Summary
      </p>
      {loading ? (
        <p className="mt-4 text-white font-semibold text-base leading-8">
          Generating a plain-language summary for this ZIP code...
        </p>
      ) : (
        <p className="mt-4 text-white font-semibold text-base leading-8">{summary}</p>
      )}
    </section>
  );
}

function QRootsSummaryCard({ overallScore, tract, summary, summaryLoading }) {
  const [copied, setCopied] = useState(false);
  const tone = scoreTone(overallScore);
  const dimensionKeys = ["housing_stability_score", "walk_score", "transit_score", "education_score", "affordability_score"];

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (_error) {
      setCopied(false);
    }
  }

  return (
    <section className="mb-6 rounded-[2rem] border border-white/30 bg-black/40 p-6 shadow-sm shadow-slate-200/50 backdrop-blur-lg">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-white">QRoots Score</p>
            <button
              type="button"
              onClick={handleCopyLink}
              className="rounded-full border border-amber-500/60 bg-amber-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-amber-500"
            >
              Copy Link
            </button>
            <span
              className={`text-xs font-medium text-emerald-700 transition-opacity duration-300 ${
                copied ? "opacity-100" : "opacity-0"
              }`}
            >
              Copied!
            </span>
          </div>
          <div className="mt-3 flex items-end gap-3">
            <span className={`text-5xl font-bold tracking-tight ${tone.text}`}>{formatScore(overallScore)}</span>
            <span className="pb-1 text-base font-semibold text-white">/ 100</span>
          </div>
          <p className="mt-3 text-sm leading-6 font-semibold text-white">
            {summaryLoading
              ? "Generating a plain-language summary for this ZIP code..."
              : summary ||
                "A composite neighborhood score balancing housing stability, walkability, transit access, educational attainment, and affordability."}
          </p>
        </div>
        <div className="grid flex-1 gap-4">
          {dimensionKeys.map((key) => (
            <DimensionBar key={key} label={dimensionLabels[key]} value={tract?.[key]} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ResultCard({ tract, zip }) {
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const stateFips = String(tract.GEOID || "").slice(0, 2);
  const stateInfo = stateInfoByFips[stateFips];
  const stateName = stateInfo?.name ?? "Unknown";
  const tractZip = zip || "";
  const zipEnabled = Boolean(tractZip);
  const resources = [
    {
      label: "🏠 Housing Assistance",
      href: "https://www.hud.gov/topics/rental_assistance",
      enabled: true,
    },
    {
      label: "🚶 Walk Score",
      href: zipEnabled ? `https://www.walkscore.com/score/${tractZip}` : "#",
      enabled: zipEnabled,
    },
    {
      label: "🚌 Transit",
      href: zipEnabled
        ? `https://www.google.com/maps/dir/?api=1&travelmode=transit&origin=${tractZip}+USA`
        : "#",
      enabled: zipEnabled,
    },
    {
      label: "🎓 Schools",
      href: zipEnabled ? `https://www.greatschools.org/search/search.page?zip=${tractZip}` : "#",
      enabled: zipEnabled,
    },
    {
      label: "💰 Rental Affordability",
      href: "https://www.huduser.gov/portal/datasets/fmr.html",
      enabled: true,
    },
    {
      label: "🧠 Mental Health Resources",
      href: zipEnabled ? `https://findtreatment.gov/?zip=${tractZip}&sType=MH` : "#",
      enabled: zipEnabled,
    },
    {
      label: "🏳️‍🌈 LGBT Resources",
      href: `https://www.mapresearch.org/equality-maps/profile_state/${stateInfo?.abbr ?? ""}`,
      enabled: Boolean(stateInfo),
    },
    {
      label: "🏳️‍🌈 LGBT Community Centers",
      href: "https://www.lgbtqcenters.org",
      enabled: true,
    },
  ];

  return (
    <article className="rounded-3xl border border-white/30 bg-black/40 p-6 shadow-sm shadow-slate-200/60 backdrop-blur-lg">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-white text-xs font-semibold uppercase tracking-[0.24em]">Census Tract</p>
          {zip ? <p className="mt-1 text-xs font-semibold text-white">ZIP {zip}</p> : null}
          <h2 className="text-white text-2xl font-semibold mt-2">{tract.GEOID}</h2>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <span
            className="inline-flex rounded-full border px-3 py-1 text-sm font-semibold capitalize"
            style={badgeStyles[tract.risk_tier] ?? badgeStyles.low}
          >
            {tract.risk_tier}
          </span>
          <div className="text-left sm:text-right">
            <p className="text-white text-xs font-semibold uppercase tracking-[0.24em]">Housing Stability Risk</p>
            <p className="mt-1 text-3xl font-bold text-white">{formatPercent(tract.predicted_risk_score)}</p>
          </div>
        </div>
      </div>
      <div className="mt-6">
        <p className="text-white text-sm font-semibold">Top driving factors</p>
        <ul className="mt-3 space-y-3">
          {tract.top_driving_factors?.map((factor) => {
            const shap = formatShapValue(factor.shap_value ?? 0);
            return (
              <li
                key={`${tract.GEOID}-${factor.feature}`}
                className="flex items-center justify-between rounded-2xl border border-white/20 bg-black/30 px-4 py-3"
              >
                <div>
                  <p className="text-white font-medium">{factor.label}</p>
                  <p className="text-white font-semibold text-sm">
                    {Number(factor.shap_value) >= 0 ? "Associated with higher risk" : "Associated with lower risk"}
                  </p>
                </div>
                <span className={`text-sm font-semibold ${shap.tone}`}>{shap.text}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-6 rounded-2xl border border-white/30 bg-black/30">
        <button
          type="button"
          onClick={() => setResourcesOpen((open) => !open)}
          className="flex w-full items-center justify-between px-4 py-4 text-left"
        >
          <span className="text-white text-sm font-semibold">Resources</span>
          <span className="text-sm font-semibold text-white">
            {resourcesOpen ? "Hide" : "Show"}
          </span>
        </button>

        {resourcesOpen ? (
          <div className="border-t border-slate-200 px-4 py-4">
            <div className="grid gap-3">
              {resources.map((resource) => (
                resource.enabled ? (
                  <a
                    key={resource.label}
                    href={resource.href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-2xl border border-white/20 bg-black/30 px-4 py-3 text-sm font-medium text-amber-400 transition hover:bg-black/40 hover:text-amber-300"
                  >
                    {resource.label}
                  </a>
                ) : (
                  <div
                    key={resource.label}
                    className="rounded-2xl bg-black/30 px-4 py-3 text-sm font-medium text-white"
                  >
                    {resource.label} unavailable without ZIP context
                  </div>
                )
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function ExplorerResultCard({ result, rank, onViewFullReport }) {
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const stateInfo = stateInfoByAbbr[result.state_abbr];
  const zipEnabled = Boolean(result.zip);
  const resources = [
    {
      label: "🏠 Housing Assistance",
      href: "https://www.hud.gov/topics/rental_assistance",
      enabled: true,
    },
    {
      label: "🚶 Walk Score",
      href: zipEnabled ? `https://www.walkscore.com/score/${result.zip}` : "#",
      enabled: zipEnabled,
    },
    {
      label: "🚌 Transit",
      href: zipEnabled
        ? `https://www.google.com/maps/dir/?api=1&travelmode=transit&origin=${result.zip}+USA`
        : "#",
      enabled: zipEnabled,
    },
    {
      label: "🎓 Schools",
      href: zipEnabled ? `https://www.greatschools.org/search/search.page?zip=${result.zip}` : "#",
      enabled: zipEnabled,
    },
    {
      label: "💰 Rental Affordability",
      href: "https://www.huduser.gov/portal/datasets/fmr.html",
      enabled: true,
    },
    {
      label: "🧠 Mental Health Resources",
      href: zipEnabled ? `https://findtreatment.gov/?zip=${result.zip}&sType=MH` : "#",
      enabled: zipEnabled,
    },
    {
      label: "🏳️‍🌈 LGBT Resources",
      href: stateInfo
        ? `https://www.mapresearch.org/equality-maps/profile_state/${stateInfo.abbr}`
        : "#",
      enabled: Boolean(stateInfo),
    },
    {
      label: "🏳️‍🌈 LGBT Community Centers",
      href: "https://www.lgbtqcenters.org",
      enabled: true,
    },
  ];

  return (
    <article className="rounded-3xl border border-white/30 bg-black/40 p-6 shadow-sm shadow-slate-200/60 backdrop-blur-lg">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-white text-xs font-semibold uppercase tracking-[0.24em]">Rank #{rank}</p>
          <h2 className="text-white text-3xl font-semibold mt-2">{result.zip}, {result.state_abbr}</h2>
        </div>
        <div className="text-right">
          <p className="text-white text-xs font-semibold uppercase tracking-[0.24em]">Custom Score</p>
          <p className={`mt-2 text-3xl font-bold ${scoreTone(result.custom_score).text}`}>{formatScore(result.custom_score)}</p>
        </div>
      </div>
      <div className="mt-5 rounded-2xl bg-black/30 px-4 py-3 text-white font-semibold text-sm">
        <span className="font-semibold text-white">{result.tract_count}</span> tract(s) analyzed
      </div>
      <div className="mt-5 grid gap-3">
        <MiniDimensionBar label="QRoots" value={result.avg_qroots_score} />
        <MiniDimensionBar label="Housing Stability" value={result.avg_housing_stability} />
        <MiniDimensionBar label="Walkability" value={result.avg_walk_score} />
        <MiniDimensionBar label="Transit" value={result.avg_transit_score} />
        <MiniDimensionBar label="Education" value={result.avg_education_score} />
        <MiniDimensionBar label="Affordability" value={result.avg_affordability_score} />
        <MiniDimensionBar label="LGBT Policy" value={result.avg_lgbt_score} />
      </div>

      <div className="mt-6 rounded-2xl border border-white/30 bg-black/30">
        <button
          type="button"
          onClick={() => setResourcesOpen((open) => !open)}
          className="flex w-full items-center justify-between px-4 py-4 text-left"
        >
          <span className="text-white text-sm font-semibold">Resources</span>
          <span className="text-sm font-semibold text-white">
            {resourcesOpen ? "Hide" : "Show"}
          </span>
        </button>

        {resourcesOpen ? (
          <div className="border-t border-slate-200 px-4 py-4">
            <div className="grid gap-3">
              {resources.map((resource) => (
                resource.enabled ? (
                  <a
                    key={resource.label}
                    href={resource.href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-2xl border border-white/20 bg-black/30 px-4 py-3 text-sm font-medium text-amber-400 transition hover:bg-black/40 hover:text-amber-300"
                  >
                    {resource.label}
                  </a>
                ) : (
                  <div
                    key={resource.label}
                    className="rounded-2xl bg-black/30 px-4 py-3 text-sm font-medium text-white"
                  >
                    {resource.label} unavailable without ZIP context
                  </div>
                )
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onViewFullReport?.(result.zip)}
        className="mt-6 h-11 w-full rounded-2xl bg-amber-600 text-sm font-semibold text-white transition hover:bg-amber-500"
      >
        View Full Report
      </button>
    </article>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState("search");
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
  const [zipQRootsScore, setZipQRootsScore] = useState(null);
  const [zipSummary, setZipSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [exploreState, setExploreState] = useState("TX");
  const [exploreWeights, setExploreWeights] = useState({ housing: 0, walk: 0, transit: 0, education: 0, affordability: 0, lgbt: 0 });
  const [exploreLimit, setExploreLimit] = useState(10);
  const [exploreLoading, setExploreLoading] = useState(false);
  const [exploreError, setExploreError] = useState("");
  const [exploreResults, setExploreResults] = useState([]);
  const [exploreUrlCopied, setExploreUrlCopied] = useState(false);

  const zipResultStateFips = useMemo(() => {
    if (searchMode !== "zip" || results.length === 0) return [];
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
            const stateGeoids = results.filter((t) => t.GEOID.startsWith(stateFips)).map((t) => t.GEOID);
            return fetchStateTractsGeoJson(stateFips, stateGeoids);
          })
        );
        const tractGeoids = new Set(results.map((tract) => tract.GEOID));
        const mergedFeatures = geoJsonResponses
          .flatMap((geoJson) => geoJson.features ?? [])
          .filter((feature) => tractGeoids.has(feature?.properties?.GEOID));
        setTractGeoJson({ type: "FeatureCollection", features: mergedFeatures });
      } catch (mapLoadError) {
        setTractGeoJson(null);
        setMapError(mapLoadError.message || "Unable to load map boundaries.");
      } finally {
        setMapLoading(false);
      }
    }
    loadMapData();
  }, [results, searchMode, zipResultStateFips]);

  useEffect(() => {
    async function loadZipSummary() {
      if (searchMode !== "zip" || !searchedZip || results.length === 0) {
        setZipSummary("");
        setSummaryLoading(false);
        return;
      }
      setSummaryLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/summary/${searchedZip}?weight_housing=${exploreWeights.housing/100}&weight_walk=${exploreWeights.walk/100}&weight_transit=${exploreWeights.transit/100}&weight_education=${exploreWeights.education/100}&weight_affordability=${exploreWeights.affordability/100}&weight_lgbt=${exploreWeights.lgbt/100}`);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.detail || "Unable to generate neighborhood summary.");
        setZipSummary(payload.summary || "");
      } catch (_summaryError) {
        setZipSummary("We couldn't generate an AI neighborhood summary right now, but you can still explore the tract scores and map below.");
      } finally {
        setSummaryLoading(false);
      }
    }
    loadZipSummary();
  }, [results, searchMode, searchedZip]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const zipParam = params.get("zip");
    const geoidParam = params.get("geoid");

    if (zipParam) {
      setActiveTab("search");
      setQuery(zipParam);
      runSearch(zipParam, false);
      return;
    }

    if (geoidParam) {
      setActiveTab("search");
      setQuery(geoidParam);
      runSearch(geoidParam, false);
    }
  }, []);

  async function runSearch(searchValue, shouldPushState = true) {
    setError("");
    setResults([]);
    setTractGeoJson(null);
    setMapError("");
    setZipQRootsScore(null);
    setSearchedZip("");
    setZipSummary("");
    setSummaryLoading(false);

    const parsed = parseSearchInput(searchValue);
    if (!parsed) {
      setError("Enter either an 11-digit tract GEOID or a 5-digit ZIP code.");
      return;
    }

    setQuery(searchValue);
    setLoading(true);
    try {
      if (parsed.type === "tract") {
        const response = await fetch(`${API_BASE_URL}/tract/${parsed.geoid}`);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.detail || "Unable to load tract data.");
        setResults([payload]);
        setSearchContext(`Showing QRoots score for tract ${payload.GEOID}`);
        setSearchMode("tract");
        setZipQRootsScore(payload.qroots_score ?? null);
        setSearchedZip("");
        if (shouldPushState) {
          window.history.pushState({}, "", `?geoid=${payload.GEOID}`);
        }
      } else {
        const response = await fetch(`${API_BASE_URL}/zip/${parsed.zipcode}`);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.detail || "Unable to load ZIP code data.");
        setResults(payload.tracts || []);
        setSearchContext(`Showing ${payload.tract_count} tracts for ZIP ${payload.zip}`);
        setSearchMode("zip");
        setZipQRootsScore(payload.zip_qroots_score ?? null);
        setSearchedZip(parsed.zipcode);
        if (shouldPushState) {
          window.history.pushState({}, "", `?zip=${payload.zip}`);
        }
      }
    } catch (searchError) {
      setError(searchError.message || "Something went wrong while searching.");
      setSearchMode("");
      setZipQRootsScore(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(event) {
    event.preventDefault();
    await runSearch(query, true);
  }

  function handleWeightChange(key, value) {
    setExploreWeights((currentWeights) => rebalanceWeights(currentWeights, key, value));
  }

function handleWeightInput(key, value) {
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));
  setExploreWeights((currentWeights) => {
    const otherKeys = Object.keys(currentWeights).filter((k) => k !== key);
    const otherTotal = otherKeys.reduce((sum, k) => sum + (Number(currentWeights[k]) || 0), 0);
    const newTotal = clamped + otherTotal;
    if (newTotal <= 100) {
      return { ...currentWeights, [key]: clamped };
    }
    const excess = newTotal - 100;
    const updated = { ...currentWeights, [key]: clamped };
    let remaining = excess;
    const keysWithValue = otherKeys.filter((k) => (Number(currentWeights[k]) || 0) > 0).reverse();
    for (const k of keysWithValue) {
      const current = Number(updated[k]) || 0;
      const deduct = Math.min(current, remaining);
      updated[k] = current - deduct;
      remaining -= deduct;
      if (remaining <= 0) break;
    }
    return updated;
  });
}

  async function handleExplore(event) {
    event.preventDefault();
    setExploreLoading(true);
    setExploreError("");
    setExploreResults([]);
    try {
      const totalWeight = Object.values(exploreWeights).reduce((sum, value) => sum + (Number(value) || 0), 0);
      const normalizedWeights = totalWeight > 0
        ? Object.fromEntries(
            Object.entries(exploreWeights).map(([key, value]) => [key, ((Number(value) || 0) / totalWeight) * 100])
          )
        : exploreWeights;

      const params = new URLSearchParams({
        state_abbr: exploreState,
        weight_housing: String(normalizedWeights.housing / 100),
        weight_walk: String(normalizedWeights.walk / 100),
        weight_transit: String(normalizedWeights.transit / 100),
        weight_education: String(normalizedWeights.education / 100),
        weight_affordability: String(normalizedWeights.affordability / 100),
        weight_lgbt: String(normalizedWeights.lgbt / 100),
        limit: String(exploreLimit),
      });
      const response = await fetch(`${API_BASE_URL}/explore?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Unable to load explorer results.");
      setExploreResults(payload.results || []);
      window.history.pushState({}, "", `?explore=1&state=${exploreState}&limit=${exploreLimit}`);
    } catch (exploreRequestError) {
      setExploreError(exploreRequestError.message || "Something went wrong while loading explorer results.");
    } finally {
      setExploreLoading(false);
    }
  }

  async function handleCopyExploreLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setExploreUrlCopied(true);
      window.setTimeout(() => setExploreUrlCopied(false), 2000);
    } catch (_error) {
      setExploreUrlCopied(false);
    }
  }

  async function handleViewFullExploreReport(zip) {
    if (!zip) return;
    setActiveTab("search");
    setQuery(zip);
    await runSearch(zip, true);
  }

  return (
    <div
      className="relative min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-purple-950 text-slate-100"
      style={{
        backgroundImage: "url('/tree-bg.jpg')",
        backgroundPosition: "center bottom",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="relative z-20 mx-auto max-w-6xl px-6 py-12 sm:px-8 lg:px-10">
        <header className="rounded-[2rem] border border-white/70 bg-black/40 px-8 py-10 shadow-xl shadow-slate-200/50 backdrop-blur-lg">
          <div className="text-center">
            <div className="bg-black/40 rounded-3xl p-4 inline-block mx-auto">
              <img src="/QRoots_logo.png" alt="QRoots logo" className="mx-auto h-56 w-auto sm:h-64" />
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Find Your Perfect Place to Grow.
            </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 font-semibold text-white">
  Search by ZIP code or census tract to surface neighborhood quality scores, or
  use Explore mode to discover top neighborhoods in any state by what matters
  most to you.
</p>
          </div>

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
              className="inline-flex h-14 items-center justify-center rounded-2xl bg-amber-600 px-6 text-base font-semibold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {loading ? "Searching..." : "Search QRoots"}
            </button>
          </form>

          <p className="mt-3 text-sm font-semibold text-white">
            Examples: <span className="font-semibold text-white">17031010100</span> or{" "}
            <span className="font-semibold text-white">78229</span>
          </p>

          <div className="mt-6 inline-flex rounded-2xl border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("search")}
              className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${
                activeTab === "search" ? "bg-white text-slate-900 shadow-sm" : "text-gray-300 hover:bg-white/20"
              }`}
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("explore")}
              className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${
                activeTab === "explore" ? "bg-white text-slate-900 shadow-sm" : "text-gray-300 hover:bg-white/20"
              }`}
            >
              Explore
            </button>
          </div>
        </header>

        <main className="mt-8">
          {activeTab === "explore" ? (
            <>
              <section className="rounded-[2rem] border border-white/30 bg-black/40 p-6 shadow-sm shadow-slate-200/50 backdrop-blur-lg">
                <form onSubmit={handleExplore} className="grid gap-6">
                  <div className="grid gap-5 lg:grid-cols-3">
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold text-white">State</span>
                      <select
                        value={exploreState}
                        onChange={(event) => setExploreState(event.target.value)}
                        className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 focus:border-teal-500 focus:outline-none"
                      >
                        {stateOptions.map((state) => (
                          <option key={state} value={state}>{state}</option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold text-white">Top Results</span>
                      <select
                        value={exploreLimit}
                        onChange={(event) => setExploreLimit(Number(event.target.value))}
                        className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 focus:border-teal-500 focus:outline-none"
                      >
                        {[5, 10, 25].map((value) => (
                          <option key={value} value={value}>Top {value}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="grid gap-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-white">Dimension Weights</p>
                      <p className="text-sm font-semibold text-white">
                        Total: {Object.values(exploreWeights).reduce((sum, value) => sum + value, 0)}%
                      </p>
                    </div>
                    {weightConfig.map((item) => (
                      <div key={item.key} className="grid gap-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-white">{item.label}</label>
                          <span className="text-sm font-semibold text-white">{exploreWeights[item.key]}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={exploreWeights[item.key]}
                          onChange={(event) => handleWeightChange(item.key, event.target.value)}
                          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-4 my-2">
                    <div className="flex-1 border-t border-white/30" />
                    <p className="text-xs font-semibold text-white/70 text-center px-2">
                      Use sliders above <span className="text-amber-400">OR</span> type percentages below — they control the same weights
                    </p>
                    <div className="flex-1 border-t border-white/30" />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {weightConfig.map((item) => (
                      <label key={item.key} className="grid gap-2">
                        <span className="text-sm font-semibold text-white">
                          {item.label} Priority %
                        </span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={exploreWeights[item.key]}
                          onChange={(event) => handleWeightInput(item.key, event.target.value)}
                          className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 focus:border-amber-500 focus:outline-none"
                        />
                      </label>
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
  <p className="text-xs font-semibold text-white/70">
    Weights are automatically normalized to 100%. Leave unused dimensions at 0.
  </p>
  <button
    type="button"
    onClick={() => setExploreWeights({ housing: 0, walk: 0, transit: 0, education: 0, affordability: 0, lgbt: 0 })}
    className="rounded-full border border-white/30 bg-black/30 px-3 py-1 text-xs font-semibold text-white transition hover:bg-black/50"
  >
    Reset all to 0
  </button>
</div>

                  <div>
                    <button
                      type="submit"
                      disabled={exploreLoading}
                      className="inline-flex h-14 items-center justify-center rounded-2xl bg-amber-600 px-6 text-base font-semibold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      {exploreLoading ? "Finding..." : "Find My Neighborhood"}
                    </button>
                  </div>
                </form>
              </section>

              {exploreError ? (
                <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
                  {exploreError}
                </div>
              ) : null}

              {exploreResults.length > 0 ? (
                <>
                  <div className="mt-6 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleCopyExploreLink}
                      className="rounded-full border border-amber-500/60 bg-amber-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-amber-500"
                    >
                      Copy Link
                    </button>
                    <span
                      className={`text-xs font-medium text-emerald-700 transition-opacity duration-300 ${
                        exploreUrlCopied ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      Copied!
                    </span>
                  </div>
                  <div className="mt-4 grid gap-5 lg:grid-cols-2">
                    {exploreResults.map((result, index) => (
                      <ExplorerResultCard
                        key={`${result.zip}-${result.state_abbr}`}
                        result={result}
                        rank={index + 1}
                        onViewFullReport={handleViewFullExploreReport}
                      />
                    ))}
                  </div>
                </>
              ) : !exploreLoading ? (
                <section className="mt-6 rounded-[2rem] border border-white/30 bg-black/40 backdrop-blur-lg px-8 py-16 text-center">
                  <h2 className="text-2xl font-semibold text-white">Explore top ZIP codes by what matters most to you</h2>
                  <p className="mx-auto mt-3 max-w-2xl text-base leading-7 font-semibold text-white">
                    Adjust the score weights and minimum thresholds to surface neighborhoods
                    that best fit your priorities across housing stability, walkability,
                    transit, education, affordability, and LGBT policy.
                  </p>
                </section>
              ) : null}
            </>
          ) : (
            <>
              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              {searchContext ? (
                <div className="mb-5 flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">{searchContext}</p>
                  {results.length > 0 ? <p className="text-sm font-semibold text-white">{results.length} result(s)</p> : null}
                </div>
              ) : null}

              {results.length > 0 ? (
                <QRootsSummaryCard
                  overallScore={searchMode === "zip" ? zipQRootsScore : results[0]?.qroots_score}
                  tract={results[0]}
                  summary={searchMode === "zip" ? zipSummary : ""}
                  summaryLoading={searchMode === "zip" ? summaryLoading : false}
                />
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
                <section className="grid gap-5 lg:grid-cols-3">
                  <article className="rounded-[2rem] border border-white/30 bg-black/40 p-6 shadow-lg shadow-slate-200/40 backdrop-blur-lg">
                    <div className="inline-flex rounded-full bg-teal-100 px-3 py-1 text-lg">
                      🔍
                    </div>
                    <h2 className="mt-5 text-xl font-semibold text-white">Search Any Neighborhood</h2>
                    <p className="mt-3 text-base leading-7 font-semibold text-white">
                      Enter a ZIP code or census tract GEOID to get an instant QRoots score,
                      housing stability risk, AI summary, and interactive map.
                    </p>
                  </article>

                  <article className="rounded-[2rem] border border-white/30 bg-black/40 p-6 shadow-lg shadow-slate-200/40 backdrop-blur-lg">
                    <div className="inline-flex rounded-full bg-indigo-100 px-3 py-1 text-lg">
                      🧭
                    </div>
                    <h2 className="mt-5 text-xl font-semibold text-white">Explore by What Matters</h2>
                    <p className="mt-3 text-base leading-7 font-semibold text-white">
                      Use Explore mode to rank every ZIP code in any state by six customizable
                      dimensions including walkability, affordability, and LGBT policy.
                    </p>
                  </article>

                  <article className="rounded-[2rem] border border-white/30 bg-black/40 p-6 shadow-lg shadow-slate-200/40 backdrop-blur-lg">
                    <div className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-lg">
                      🤖
                    </div>
                    <h2 className="mt-5 text-xl font-semibold text-white">AI-Powered Insights</h2>
                    <p className="mt-3 text-base leading-7 font-semibold text-white">
                      Every ZIP search generates a plain-language neighborhood summary powered
                      by OpenAI, plus contextual resource links tailored to that location.
                    </p>
                  </article>
                </section>
              ) : null}
            </>
          )}
        </main>

        <footer className="mt-10 rounded-[2rem] border border-white/70 bg-black/40 px-8 py-6 shadow-sm shadow-slate-200/40 backdrop-blur-lg">
          <p className="text-sm leading-7 font-semibold text-white">
            QRoots is designed to help people make informed decisions about where to live and
            to support housing intervention efforts. Scores are advisory and reflect
            neighborhood-level patterns, not individual circumstances. Data sources: Census ACS 5-Year Estimates, Princeton Eviction Lab, CDC PLACES 2025, 
            Walk Score, HUD Fair Market Rent, Movement Advancement Project (MAP).
          </p>
          <p className="mt-3 text-sm leading-7 font-semibold text-white">
            Eviction data reflects 2016 validated records. Walk Score data reflects city-level
            averages. QRoots composite score weighted: Housing Stability 40%, Walkability 20%,
            Transit 15%, Education 15%, Affordability 10%. LGBT Policy score reflects
            state-level policy tally from the Movement Advancement Project (MAP), normalized
            to 0–100. Model trained on XGBoost with AUC-ROC 0.81.
          </p>
          <a
            href="https://github.com/timothytroyhollis-ctrl/QRoots"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex text-sm font-medium text-amber-400 transition hover:text-amber-300"
          >
            View the GitHub repository →
          </a>
          <div className="mt-4 border-t border-slate-200 pt-4 text-center text-xs font-semibold text-white">
            Built with OpenAI Codex — see the full 40+ prompt log{" "}
            <a
              href="https://github.com/timothytroyhollis-ctrl/QRoots/blob/main/docs/codex-prompts.md"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-amber-400 transition hover:text-amber-300"
            >
              here
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
