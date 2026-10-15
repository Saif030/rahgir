import { useEffect, useRef, useState } from "react";
import { LocateFixed, Navigation } from "lucide-react";
import Card from "../components/ui/Card";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchVenues } from "../store/eventsSlice";

/** AR Preview: camera overlay + compass arrow pointing to the next venue. */
export default function ArPreview() {
  const dispatch = useAppDispatch();
  const venues = useAppSelector((s) => s.events.venues);
  const venuesStatus = useAppSelector((s) => s.events.status);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [venueId, setVenueId] = useState("");
  const [heading, setHeading] = useState<number | null>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [camError, setCamError] = useState<string | null>(null);

  useEffect(() => {
    if (venues.length === 0) void dispatch(fetchVenues());
  }, [dispatch, venues.length]);

  useEffect(() => {
    if (!venueId && venues.length > 0) setVenueId(venues[0].id);
  }, [venueId, venues]);

  const target = venues.find((v) => v.id === venueId) ?? venues[0];

  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => null);
        }
      } catch {
        setCamError("Camera unavailable — compass-only mode. HTTPS + permission required on mobile.");
      }
    })();
    const watch = navigator.geolocation?.watchPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => null,
      { enableHighAccuracy: true },
    );
    const onOrient = (e: DeviceOrientationEvent) => {
      const h = (e as unknown as { webkitCompassHeading?: number }).webkitCompassHeading;
      if (typeof h === "number") setHeading(h);
      else if (typeof e.alpha === "number") setHeading(360 - e.alpha);
    };
    window.addEventListener("deviceorientation", onOrient);
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      if (watch !== undefined) navigator.geolocation?.clearWatch(watch);
      window.removeEventListener("deviceorientation", onOrient);
    };
  }, []);

  function bearing(): number | null {
    if (!pos || !target) return null;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const toDeg = (r: number) => (r * 180) / Math.PI;
    const dLng = toRad(target.lng - pos.lng);
    const y = Math.sin(dLng) * Math.cos(toRad(target.lat));
    const x = Math.cos(toRad(pos.lat)) * Math.sin(toRad(target.lat)) - Math.sin(toRad(pos.lat)) * Math.cos(toRad(target.lat)) * Math.cos(dLng);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }

  function distanceM(): number | null {
    if (!pos || !target) return null;
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const s =
      Math.sin(toRad((target.lat - pos.lat) / 2)) ** 2 +
      Math.cos(toRad(pos.lat)) * Math.cos(toRad(target.lat)) * Math.sin(toRad((target.lng - pos.lng) / 2)) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  const b = bearing();
  const rel = b !== null && heading !== null ? ((b - heading + 540) % 360) - 180 : null;
  const direction = rel === null ? "" : rel > 10 ? "Turn right" : rel < -10 ? "Turn left" : "Straight ahead";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">AR route preview</h1>
        <p className="mt-0.5 max-w-lg text-sm text-zinc-500 dark:text-zinc-400">
          Point your phone — the arrow guides you to your venue via camera, compass and GPS.
        </p>
      </div>
      <label className="label block max-w-md">
        Destination venue
        <select value={venueId} onChange={(e) => setVenueId(e.target.value)} className="field mt-1.5" disabled={venues.length === 0}>
          {venues.length === 0 ? (
            <option value="">{venuesStatus === "loading" ? "Loading venues…" : "No venues — is the API running?"}</option>
          ) : (
            venues.map((v) => (
              <option key={v.id} value={v.id}>{v.name} ({v.building})</option>
            ))
          )}
        </select>
      </label>
      <div className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-xl border border-zinc-200 bg-zinc-950 dark:border-zinc-800">
        <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover opacity-60" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 backdrop-blur transition-transform duration-300"
            style={{ transform: `rotate(${rel ?? 0}deg)` }}
            role="img"
            aria-label={rel === null ? "Direction arrow" : `${direction}, ${Math.abs(Math.round(rel))} degrees`}
          >
            <Navigation size={32} className="fill-white" />
          </div>
          <p className="mt-4 rounded-xl bg-black/60 px-4 py-2 text-center text-sm font-semibold backdrop-blur">
            {target ? target.name : "Pick a destination"}
            <br />
            <span className="font-normal text-zinc-300">
              {distanceM() !== null ? `${Math.round(distanceM()!)} m away` : "Waiting for GPS…"}
              {direction ? ` · ${direction}` : ""}
            </span>
          </p>
          <p className="mt-2 flex items-center gap-1 text-[11px] tabular-nums text-zinc-400">
            <LocateFixed size={11} />
            {heading !== null ? `${Math.round(heading)}°` : "—"} · {b !== null ? `${Math.round(b)}°` : "—"}
          </p>
        </div>
      </div>
      {camError && (
        <Card className="max-w-md !border-amber-200 !bg-amber-50 dark:!border-amber-900/50 dark:!bg-amber-950/30">
          <p className="text-xs text-amber-800 dark:text-amber-300" role="status">{camError}</p>
        </Card>
      )}
    </div>
  );
}
