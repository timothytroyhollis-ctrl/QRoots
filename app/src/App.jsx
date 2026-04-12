import { useEffect, useMemo, useState } from "react";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";


const API_BASE_URL = "https://rootscore-api.onrender.com";
const TIGER_TRACTS_URL = "https://rootscore-api.onrender.com/tracts/geojson";

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
    return { text: "text-blue-600", fill: "bg-blue-400", panel: "from-blue-50 to-white", ring: "ring-blue-200" };
  }
  if (numericValue <= 60) {
    return { text: "text-blue-700", fill: "bg-blue-500", panel: "from-blue-50 to-white", ring: "ring-blue-200" };
  }
  return { text: "text-blue-800", fill: "bg-blue-600", panel: "from-blue-50 to-white", ring: "ring-blue-200" };
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
    <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
      <div className="mb-4 px-2 pt-2">
        <h2 className="text-lg font-semibold text-slate-900">ZIP-level tract map</h2>
        <p className="mt-1 text-sm text-slate-600">
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
          <p className="cursor-help text-sm font-medium text-slate-700 underline decoration-dotted underline-offset-4">
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
        <p className="text-xs font-medium text-slate-600">{label}</p>
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
    <section className="mb-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">
        AI Neighborhood Summary
      </p>
      {loading ? (
        <p className="mt-4 text-sm leading-7 text-slate-600">
          Generating a plain-language summary for this ZIP code...
        </p>
      ) : (
        <p className="mt-4 text-base leading-8 text-slate-700">{summary}</p>
      )}
    </section>
  );
}

function TreeRootsBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden opacity-[0.18]" aria-hidden="true">
      <svg
        viewBox="0 0 1440 600"
        className="h-full w-full"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path
            d="M720 580 C718 556 716 530 714 504 C712 474 714 444 720 412 C726 444 728 474 726 504 C724 530 722 556 720 580"
            stroke="#3F2A1E"
            strokeWidth="18"
          />
          <path
            d="M720 576 C680 544 642 512 602 486 C554 454 506 432 454 412"
            stroke="#5C4033"
            strokeWidth="16"
          />
          <path
            d="M722 576 C768 544 812 512 856 486 C906 454 958 432 1014 410"
            stroke="#3F2A1E"
            strokeWidth="16"
          />
          <path
            d="M714 576 C662 548 612 530 560 518 C488 500 416 496 338 492 C244 486 146 466 34 424"
            stroke="#5C4033"
            strokeWidth="14"
          />
          <path
            d="M726 576 C786 548 844 530 904 518 C984 500 1064 496 1150 490 C1250 484 1346 464 1406 424"
            stroke="#3F2A1E"
            strokeWidth="14"
          />
          <path
            d="M706 572 C648 548 592 538 534 536 C452 534 372 528 292 508 C202 486 112 450 10 378"
            stroke="#3F2A1E"
            strokeWidth="12"
          />
          <path
            d="M734 572 C800 548 864 538 930 536 C1018 534 1106 528 1194 506 C1288 482 1364 446 1430 378"
            stroke="#5C4033"
            strokeWidth="12"
          />
          <path
            d="M698 566 C632 530 572 500 512 462 C442 418 378 366 316 302 C258 242 210 192 162 150"
            stroke="#3F2A1E"
            strokeWidth="10"
          />
          <path
            d="M742 566 C814 530 880 500 946 462 C1022 418 1092 366 1160 300 C1220 242 1270 192 1318 150"
            stroke="#5C4033"
            strokeWidth="10"
          />
          <path
            d="M684 558 C620 532 562 520 504 510 C444 500 384 486 324 458 C248 422 170 370 86 296"
            stroke="#5C4033"
            strokeWidth="9"
          />
          <path
            d="M756 558 C826 532 890 520 954 510 C1020 500 1086 484 1152 454 C1232 418 1304 368 1380 294"
            stroke="#3F2A1E"
            strokeWidth="9"
          />
          <path
            d="M666 546 C602 526 546 518 492 510 C426 500 362 490 300 468"
            stroke="#3F2A1E"
            strokeWidth="7"
          />
          <path
            d="M776 546 C846 526 910 518 972 510 C1042 500 1110 488 1178 464"
            stroke="#5C4033"
            strokeWidth="7"
          />
          <path
            d="M640 530 C586 508 534 486 480 452 C426 418 378 376 328 324"
            stroke="#5C4033"
            strokeWidth="6"
          />
          <path
            d="M804 530 C864 508 920 486 978 450 C1036 416 1088 374 1142 320"
            stroke="#3F2A1E"
            strokeWidth="6"
          />
          <path
            d="M602 516 C548 494 500 474 452 446"
            stroke="#3F2A1E"
            strokeWidth="5"
          />
          <path
            d="M844 516 C904 494 958 472 1012 442"
            stroke="#5C4033"
            strokeWidth="5"
          />
          <path
            d="M570 500 C518 480 472 456 424 424"
            stroke="#5C4033"
            strokeWidth="4"
          />
          <path
            d="M878 500 C934 480 986 456 1040 422"
            stroke="#3F2A1E"
            strokeWidth="4"
          />
          <path
            d="M718 560 C716 530 716 500 720 468"
            stroke="#5C4033"
            strokeWidth="8"
          />
        </g>
      </svg>
    </div>
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
    <section className={`mb-6 rounded-[2rem] border bg-gradient-to-br ${tone.panel} p-6 shadow-sm shadow-slate-200/50 ring-1 ${tone.ring}`}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">QRoots Score</p>
            <button
              type="button"
              onClick={handleCopyLink}
              className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-white"
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
            <span className="pb-1 text-base font-medium text-slate-500">/ 100</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
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
        ? `https://www.google.com/maps/dir/?api=1&travelmode=transit&origin=${tractZip}`
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
      href: tractZip
        ? `https://www.lgbtqcenters.org/LGBTCenters?search=${tractZip}`
        : "https://www.lgbtqcenters.org/LGBTCenters",
      enabled: true,
    },
  ];

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/60">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Census Tract</p>
          {zip ? <p className="mt-1 text-xs text-slate-400">ZIP {zip}</p> : null}
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">{tract.GEOID}</h2>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold capitalize ring-1 ${badgeClasses[tract.risk_tier] ?? badgeClasses.low}`}>
            {tract.risk_tier}
          </span>
          <div className="text-left sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Housing Stability Risk</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{formatPercent(tract.predicted_risk_score)}</p>
          </div>
        </div>
      </div>
      <div className="mt-6">
        <p className="text-sm font-semibold text-slate-900">Top driving factors</p>
        <ul className="mt-3 space-y-3">
          {tract.top_driving_factors?.map((factor) => {
            const shap = formatShapValue(factor.shap_value ?? 0);
            return (
              <li key={`${tract.GEOID}-${factor.feature}`} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <div>
                  <p className="font-medium text-slate-900">{factor.label}</p>
                  <p className="text-sm text-slate-500">
                    {Number(factor.shap_value) >= 0 ? "Associated with higher risk" : "Associated with lower risk"}
                  </p>
                </div>
                <span className={`text-sm font-semibold ${shap.tone}`}>{shap.text}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80">
        <button
          type="button"
          onClick={() => setResourcesOpen((open) => !open)}
          className="flex w-full items-center justify-between px-4 py-4 text-left"
        >
          <span className="text-sm font-semibold text-slate-900">Resources</span>
          <span className="text-sm font-medium text-slate-500">
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
                    className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-teal-700 transition hover:bg-teal-50 hover:text-teal-800"
                  >
                    {resource.label}
                  </a>
                ) : (
                  <div
                    key={resource.label}
                    className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-400"
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
        ? `https://www.google.com/maps/dir/?api=1&travelmode=transit&origin=${result.zip}`
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
      href: result.zip
        ? `https://www.lgbtqcenters.org/LGBTCenters?search=${result.zip}`
        : "https://www.lgbtcenters.org/LGBTCenters",
      enabled: true,
    },
  ];

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/60">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Rank #{rank}</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">{result.zip}, {result.state_abbr}</h2>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Custom Score</p>
          <p className={`mt-2 text-3xl font-bold ${scoreTone(result.custom_score).text}`}>{formatScore(result.custom_score)}</p>
        </div>
      </div>
      <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <span className="font-medium text-slate-900">{result.tract_count}</span> tract(s) analyzed
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

      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80">
        <button
          type="button"
          onClick={() => setResourcesOpen((open) => !open)}
          className="flex w-full items-center justify-between px-4 py-4 text-left"
        >
          <span className="text-sm font-semibold text-slate-900">Resources</span>
          <span className="text-sm font-medium text-slate-500">
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
                    className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-teal-700 transition hover:bg-teal-50 hover:text-teal-800"
                  >
                    {resource.label}
                  </a>
                ) : (
                  <div
                    key={resource.label}
                    className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-400"
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
        className="mt-6 h-11 w-full rounded-2xl bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800"
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
  const [exploreWeights, setExploreWeights] = useState({ housing: 40, walk: 20, transit: 15, education: 15, affordability: 10, lgbt: 0 });
  const [exploreMins, setExploreMins] = useState({ housing: 0, walk: 0, transit: 0, education: 0, affordability: 0, lgbt: 0 });
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
        const response = await fetch(`${API_BASE_URL}/summary/${searchedZip}`);
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

  function handleMinChange(key, value) {
    const clamped = Math.max(0, Math.min(100, Number(value) || 0));
    setExploreMins((currentMins) => ({ ...currentMins, [key]: clamped }));
  }

  async function handleExplore(event) {
    event.preventDefault();
    setExploreLoading(true);
    setExploreError("");
    setExploreResults([]);
    try {
      const params = new URLSearchParams({
        state_abbr: exploreState,
        min_housing: String(exploreMins.housing),
        min_walk: String(exploreMins.walk),
        min_transit: String(exploreMins.transit),
        min_education: String(exploreMins.education),
        min_affordability: String(exploreMins.affordability),
        min_lgbt: String(exploreMins.lgbt),
        weight_housing: String(exploreWeights.housing / 100),
        weight_walk: String(exploreWeights.walk / 100),
        weight_transit: String(exploreWeights.transit / 100),
        weight_education: String(exploreWeights.education / 100),
        weight_affordability: String(exploreWeights.affordability / 100),
        weight_lgbt: String(exploreWeights.lgbt / 100),
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
    <div className="relative min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(20,83,45,0.6),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(22,101,52,0.35),transparent_50%),linear-gradient(180deg,#d1fae5_0%,#a7f3d0_50%,#6ee7b7_100%)] text-slate-900">
      <TreeRootsBackground />
      <div className="mx-auto max-w-6xl px-6 py-12 sm:px-8 lg:px-10">
        <header className="rounded-[2rem] border border-white/70 bg-white/80 px-8 py-10 shadow-xl shadow-slate-200/50 backdrop-blur">
          <img src="/QRoots_logo.png" alt="QRoots logo" className="mx-auto h-56 w-auto sm:h-64" />
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            Find Your Perfect Place to Grow.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
  Search by ZIP code or census tract to surface neighborhood quality scores, or
  use Explore mode to discover top neighborhoods in any state by what matters
  most to you.
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
              {loading ? "Searching..." : "Search QRoots"}
            </button>
          </form>

          <p className="mt-3 text-sm text-slate-500">
            Examples: <span className="font-medium text-slate-700">17031010100</span> or{" "}
            <span className="font-medium text-slate-700">78229</span>
          </p>

          <div className="mt-6 inline-flex rounded-2xl border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("search")}
              className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${
                activeTab === "search" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:bg-white/60"
              }`}
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("explore")}
              className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${
                activeTab === "explore" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:bg-white/60"
              }`}
            >
              Explore
            </button>
          </div>
        </header>

        <main className="mt-8">
          {activeTab === "explore" ? (
            <>
              <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
                <form onSubmit={handleExplore} className="grid gap-6">
                  <div className="grid gap-5 lg:grid-cols-3">
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold text-slate-700">State</span>
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
                      <span className="text-sm font-semibold text-slate-700">Top Results</span>
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
                      <p className="text-sm font-semibold text-slate-900">Dimension Weights</p>
                      <p className="text-sm text-slate-500">
                        Total: {Object.values(exploreWeights).reduce((sum, value) => sum + value, 0)}%
                      </p>
                    </div>
                    {weightConfig.map((item) => (
                      <div key={item.key} className="grid gap-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-slate-700">{item.label}</label>
                          <span className="text-sm font-semibold text-slate-900">{exploreWeights[item.key]}%</span>
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

                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                    {weightConfig.map((item) => (
                      <label key={item.key} className="grid gap-2">
                        <span className="text-sm font-semibold text-slate-700">Min {item.label}</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={exploreMins[item.key]}
                          onChange={(event) => handleMinChange(item.key, event.target.value)}
                          className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 focus:border-teal-500 focus:outline-none"
                        />
                      </label>
                    ))}
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={exploreLoading}
                      className="inline-flex h-14 items-center justify-center rounded-2xl bg-slate-950 px-6 text-base font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
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
                      className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-white"
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
                <section className="mt-6 rounded-[2rem] border border-dashed border-slate-300 bg-white/60 px-8 py-16 text-center">
                  <h2 className="text-2xl font-semibold text-slate-900">Explore top ZIP codes by what matters most to you</h2>
                  <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-slate-600">
                    Adjust the score weights and minimum thresholds to surface neighborhoods
                    that best fit your priorities across housing stability, walkability,
                    transit, education, and affordability.
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
                  <p className="text-sm font-medium text-slate-600">{searchContext}</p>
                  {results.length > 0 ? <p className="text-sm text-slate-500">{results.length} result(s)</p> : null}
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
                  <article className="rounded-[2rem] border border-white/80 bg-white/85 p-6 shadow-lg shadow-slate-200/40 backdrop-blur">
                    <div className="inline-flex rounded-full bg-teal-100 px-3 py-1 text-lg">
                      🔍
                    </div>
                    <h2 className="mt-5 text-xl font-semibold text-slate-900">Search Any Neighborhood</h2>
                    <p className="mt-3 text-base leading-7 text-slate-600">
                      Enter a ZIP code or census tract GEOID to get an instant QRoots score,
                      housing stability risk, AI summary, and interactive map.
                    </p>
                  </article>

                  <article className="rounded-[2rem] border border-white/80 bg-white/85 p-6 shadow-lg shadow-slate-200/40 backdrop-blur">
                    <div className="inline-flex rounded-full bg-indigo-100 px-3 py-1 text-lg">
                      🧭
                    </div>
                    <h2 className="mt-5 text-xl font-semibold text-slate-900">Explore by What Matters</h2>
                    <p className="mt-3 text-base leading-7 text-slate-600">
                      Use Explore mode to rank every ZIP code in any state by six customizable
                      dimensions including walkability, affordability, and LGBT policy.
                    </p>
                  </article>

                  <article className="rounded-[2rem] border border-white/80 bg-white/85 p-6 shadow-lg shadow-slate-200/40 backdrop-blur">
                    <div className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-lg">
                      🤖
                    </div>
                    <h2 className="mt-5 text-xl font-semibold text-slate-900">AI-Powered Insights</h2>
                    <p className="mt-3 text-base leading-7 text-slate-600">
                      Every ZIP search generates a plain-language neighborhood summary powered
                      by OpenAI, plus contextual resource links tailored to that location.
                    </p>
                  </article>
                </section>
              ) : null}
            </>
          )}
        </main>

        <footer className="mt-10 rounded-[2rem] border border-white/70 bg-white/70 px-8 py-6 shadow-sm shadow-slate-200/40">
          <p className="text-sm leading-7 text-slate-500">
            QRoots is designed to help people make informed decisions about where to live and
            to support housing intervention efforts. Scores are advisory and reflect
            neighborhood-level patterns, not individual circumstances. Data sources: Census ACS 5-Year Estimates, Princeton Eviction Lab, CDC PLACES 2025, 
            Walk Score, HUD Fair Market Rent, Movement Advancement Project (MAP).
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-500">
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
            className="mt-4 inline-flex text-sm font-medium text-teal-700 transition hover:text-teal-800"
          >
            View the GitHub repository →
          </a>
        </footer>
      </div>
    </div>
  );
}
