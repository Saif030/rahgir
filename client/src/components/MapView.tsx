import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { setCrowd, setCrowdBulk } from "../store/uiSlice";
import { colorFor, type ApiEvent, type OptimizedRoute, type Venue } from "../types";
import { isPast } from "../utils/format";
import { venueLoads } from "../utils/crowd";
import { subscribeVenue } from "../realtime";
import { api } from "../api/client";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

interface Props {
  events: ApiEvent[];
  venues: Venue[];
  route?: OptimizedRoute | null;
  onEventClick?: (e: ApiEvent) => void;
}

/** 3D campus map: venue markers color-coded by category, crowd rings, optimal-route overlay. */
export default function MapView({ events, venues, route, onEventClick }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const crowd = useAppSelector((s) => s.ui.crowd);
  const dispatch = useAppDispatch();
  const [heatOn, setHeatOn] = useState(true);

  // Registration-based crowd baseline per venue (total load, upcoming events only).
  const baseline = useMemo(() => venueLoads(events), [events]);
  // Effective density: live socket/organiser reading wins when present, else baseline.
  const effective = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [id, load] of Object.entries(baseline)) out[id] = load.density;
    for (const [id, d] of Object.entries(crowd)) out[id] = d;
    return out;
  }, [baseline, crowd]);

  // Preload latest live densities for all venues (one round trip; ignored when absent).
  useEffect(() => {
    let cancelled = false;
    void api
      .get("/crowd")
      .then(({ data }) => {
        if (cancelled || !Array.isArray(data)) return;
        const bulk: Record<string, number> = {};
        for (const row of data as { venueId?: unknown; density?: unknown }[]) {
          if (row && typeof row.venueId === "string" && typeof row.density === "number") {
            bulk[row.venueId] = Math.min(1, Math.max(0, row.density));
          }
        }
        if (Object.keys(bulk).length > 0) dispatch(setCrowdBulk(bulk));
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  const hasToken = TOKEN && !TOKEN.includes("YOUR_MAPBOX");

  // Init map once
  useEffect(() => {
    if (!container.current || mapRef.current || !hasToken) return;
    mapboxgl.accessToken = TOKEN!;
    const center: [number, number] =
      venues.length > 0 ? [venues[0].lng, venues[0].lat] : [77.5946, 12.9716];
    const map = new mapboxgl.Map({
      container: container.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center,
      zoom: 15,
      pitch: 60,
      bearing: -15,
      antialias: true,
    });
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new mapboxgl.GeolocateControl({ trackUserLocation: true }), "top-right");
    map.on("load", () => {
      // 3D buildings
      const layers = map.getStyle().layers ?? [];
      const label = layers.find((l) => l.type === "symbol" && l.layout?.["text-field"])?.id;
      map.addLayer(
        {
          id: "3d-buildings",
          source: "composite",
          "source-layer": "building",
          filter: ["==", "extrude", "true"],
          type: "fill-extrusion",
          minzoom: 14,
          paint: {
            "fill-extrusion-color": "#aaa",
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-base": ["get", "min_height"],
            "fill-extrusion-opacity": 0.6,
          },
        },
        label,
      );
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasToken]);

  // Venue markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hasToken) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const byVenue = new Map<string, ApiEvent[]>();
    for (const e of events) {
      const arr = byVenue.get(e.venueId) ?? [];
      arr.push(e);
      byVenue.set(e.venueId, arr);
    }

    for (const v of venues) {
      const list = byVenue.get(v.id) ?? [];
      if (list.length === 0) continue;
      const upcoming = list.filter((e) => !isPast(e.endsAt));
      const allPast = upcoming.length === 0;
      const first = upcoming[0] ?? list[0];
      const dominant = first.category;
      const el = document.createElement("button");
      el.setAttribute("aria-label", `${v.name}, ${list.length} events${allPast ? " (all ended)" : ""}`);
      el.title = `${v.name} (${v.building}) — ${list.length} event${list.length > 1 ? "s" : ""}${allPast ? " (all ended)" : ""}`;
      const bg = allPast ? "#9ca3af" : colorFor(dominant);
      el.style.cssText = `width:26px;height:26px;border-radius:50%;background:${bg};border:3px ${allPast ? "dashed" : "solid"} #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);cursor:pointer;font-size:11px;color:#fff;font-weight:700;${allPast ? "opacity:.55;filter:grayscale(1);" : ""}`;
      el.textContent = String(list.length);
      const load = baseline[v.id];
      const loadLine = load
        ? `<br/>${load.registered}/${load.capacity} registered (${Math.round(load.density * 100)}% full)`
        : "";
      const popup = new mapboxgl.Popup({ offset: 18, closeButton: false }).setHTML(
        `<strong>${escapeHtml(v.name)}</strong><br/>${escapeHtml(v.building)} · cap ${v.capacity}${loadLine}<br/>${list
          .slice(0, 4)
          .map((e) =>
            isPast(e.endsAt)
              ? `<s style="color:#9ca3af">• ${escapeHtml(e.title)} (ended)</s>`
              : `• ${escapeHtml(e.title)}`,
          )
          .join("<br/>")}${list.length > 4 ? `<br/>…+${list.length - 4} more` : ""}`,
      );
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([v.lng, v.lat])
        .setPopup(popup)
        .addTo(map);
      el.addEventListener("mouseenter", () => {
        subscribeVenue(v.id);
        // lazy crowd fetch for tooltip freshness (store it so the heat layer updates)
        void api
          .get(`/crowd/venue/${v.id}`)
          .then(({ data }) => {
            if (typeof data?.density === "number") {
              dispatch(setCrowd({ venueId: v.id, density: Math.min(1, Math.max(0, data.density)) }));
            }
          })
          .catch(() => null);
      });
      el.addEventListener("click", () => onEventClick?.(first));
      markersRef.current.push(marker);
    }
  }, [baseline, events, venues, hasToken, onEventClick, dispatch]);

  // Crowd heat rings: registration baseline (total load per venue), live readings override.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hasToken) return;
    if (!heatOn) {
      if (map.getLayer("crowd-heat")) map.removeLayer("crowd-heat");
      if (map.getSource("crowd")) map.removeSource("crowd");
      return;
    }
    const draw = () => {
      const feats = venues
        .filter((v) => (effective[v.id] ?? 0) > 0)
        .map((v) => ({
          type: "Feature" as const,
          properties: { density: effective[v.id], venueId: v.id },
          geometry: { type: "Point" as const, coordinates: [v.lng, v.lat] },
        }));
      const data = { type: "FeatureCollection" as const, features: feats };
      const src = map.getSource("crowd") as mapboxgl.GeoJSONSource | undefined;
      if (src) src.setData(data);
      else if (map.isStyleLoaded()) {
        map.addSource("crowd", { type: "geojson", data });
        map.addLayer({
          id: "crowd-heat",
          type: "circle",
          source: "crowd",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["get", "density"], 0, 12, 1, 34],
            "circle-color": ["interpolate", ["linear"], ["get", "density"], 0, "#22c55e", 0.5, "#f59e0b", 1, "#ef4444"],
            "circle-opacity": 0.35,
          },
        });
      }
    };
    if (map.isStyleLoaded()) draw();
    else map.once("load", draw);
  }, [effective, venues, hasToken, heatOn]);

  // Optimal route overlay (ordered path through sequence venues)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hasToken) return;
    const draw = async () => {
      // clear previous route line + numbered stop markers (and drop them from the ref array)
      if (map.getLayer("route-line")) map.removeLayer("route-line");
      if (map.getLayer("route-line-casing")) map.removeLayer("route-line-casing");
      if (map.getSource("route")) map.removeSource("route");
      markersRef.current = markersRef.current.filter((m) => {
        if ((m.getElement() as HTMLElement).dataset.seq) {
          m.remove();
          return false;
        }
        return true;
      });
      if (!route || route.sequence.length < 2) return;

      const evById = new Map(events.map((e) => [e.id, e]));
      const venueOf = (eventId: string) => {
        const ev = evById.get(eventId);
        return venues.find((v) => v.id === ev?.venueId);
      };
      // Road-following geometry per leg (Mapbox → OSRM on the server),
      // straight fallback only when no provider has a path.
      // Same-venue consecutive stops need no line segment (zero-length) — skip the
      // fetch/draw for those so the visible segment count matches distinct venues.
      const segments: [number, number][][] = [];
      for (let i = 1; i < route.sequence.length; i++) {
        const a = venueOf(route.sequence[i - 1]);
        const b = venueOf(route.sequence[i]);
        if (!a || !b) continue;
        if (a.id === b.id) continue;
        let coords: [number, number][] | null = null;
        try {
          const { data } = await api.get(`/routes/between/${a.id}/${b.id}`);
          const g = data.geometry as { type?: unknown; coordinates?: unknown } | null;
          if (
            g?.type === "LineString" &&
            Array.isArray(g.coordinates) &&
            g.coordinates.length >= 2
          ) {
            coords = g.coordinates as [number, number][];
          }
        } catch {
          /* fall back */
        }
        segments.push(coords ?? [[a.lng, a.lat], [b.lng, b.lat]]);
      }
      // Numbered stop markers (offset stacked stops sharing one venue so all are visible)
      const stops = route.sequence
        .map((eventId, idx) => ({ eventId, idx, venue: venueOf(eventId), event: evById.get(eventId) }))
        .filter((s) => s.venue);
      const perVenueCount = new Map<string, number>();
      const perVenueSeen = new Map<string, number>();
      for (const s of stops) perVenueCount.set(s.venue!.id, (perVenueCount.get(s.venue!.id) ?? 0) + 1);
      const stopCoords: [number, number][] = stops.map((s) => [s.venue!.lng, s.venue!.lat]);
      const render = () => {
        if (!map.getSource("route") && segments.length > 0) {
          map.addSource("route", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: segments } } });
          // White casing underlay so the path reads over the 3D basemap
          map.addLayer({
            id: "route-line-casing",
            type: "line",
            source: "route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": "#ffffff", "line-width": 9, "line-opacity": 0.9 },
          });
          // Walking-style dashed path
          map.addLayer({
            id: "route-line",
            type: "line",
            source: "route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": "#1d4ed8", "line-width": 5, "line-opacity": 0.95, "line-dasharray": [2.2, 1.4] },
          });
        }
        stops.forEach(({ eventId, idx, venue, event }) => {
          const v = venue!;
          const total = perVenueCount.get(v.id) ?? 1;
          const seen = perVenueSeen.get(v.id) ?? 0;
          perVenueSeen.set(v.id, seen + 1);
          // Spread stacked stops on a small circle so none hides under another
          let dx = 0;
          let dy = 0;
          if (total > 1) {
            const angle = (seen / total) * Math.PI * 2 - Math.PI / 2;
            const r = 16;
            dx = Math.round(Math.cos(angle) * r);
            dy = Math.round(Math.sin(angle) * r);
          }
          const el = document.createElement("div");
          el.dataset.seq = "1";
          el.setAttribute("role", "img");
          const label = `${idx + 1}. ${event?.title ?? eventId} @ ${v.name}`;
          el.setAttribute("aria-label", label);
          el.title = label;
          el.style.cssText = `width:24px;height:24px;border-radius:50%;background:#1d4ed8;color:#fff;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);transform:translate(${dx}px,${dy}px);`;
          el.textContent = String(idx + 1);
          markersRef.current.push(new mapboxgl.Marker({ element: el }).setLngLat([v.lng, v.lat]).addTo(map));
        });
        const bounds = new mapboxgl.LngLatBounds();
        const boundCoords = segments.length > 0 ? segments.flat() : stopCoords;
        boundCoords.forEach((c) => bounds.extend(c as [number, number]));
        if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 60, pitch: 60 });
      };
      if (map.isStyleLoaded()) render();
      else map.once("load", render);
    };
    void draw();
  }, [route, events, venues, hasToken]);

  if (!hasToken) {
    return (
      <div className="card flex h-96 flex-col items-center justify-center gap-2 p-6 text-center" role="alert">
        <p className="text-sm font-semibold">Map needs a Mapbox token</p>
        <p className="max-w-md text-[13px] text-zinc-500 dark:text-zinc-400">
          Set <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">VITE_MAPBOX_TOKEN</code> in{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">client/.env</code> and restart the dev
          server. Lists, itineraries and route optimization work without the map.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div ref={container} className="h-[60vh] min-h-[380px] w-full overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 md:h-[70vh]" role="application" aria-label="Interactive campus map" />
      <div className="absolute left-3 top-3 flex items-center gap-2 rounded-xl border border-zinc-200 bg-white/95 px-3 py-1.5 text-xs shadow-card backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95" aria-label="Crowd heatmap legend">
        <span className="font-semibold">Crowd</span>
        <span aria-hidden="true" className="inline-block h-1.5 w-16 rounded-full" style={{ background: "linear-gradient(90deg,#22c55e,#f59e0b,#ef4444)" }} />
        <span className="text-zinc-400">calm → packed</span>
        <button
          onClick={() => setHeatOn((h) => !h)}
          aria-pressed={heatOn}
          className="ml-1 rounded-lg px-2 py-0.5 text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          {heatOn ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}
