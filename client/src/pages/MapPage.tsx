import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Bell, Footprints, Info, MapPin, Navigation, UtensilsCrossed, X } from "lucide-react";
import MapView from "../components/MapView";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchEvents, fetchVenues } from "../store/eventsSlice";
import { fetchItineraries, optimizeItinerary, clearRoute, setActive } from "../store/itinerarySlice";
import { pushToast } from "../store/uiSlice";
import type { ApiEvent } from "../types";
import { fmtTime, isPast } from "../utils/format";

export default function MapPage() {
  const dispatch = useAppDispatch();
  const { items, filters, venues } = useAppSelector((s) => s.events);
  const { route, routeStatus, mine, activeId } = useAppSelector((s) => s.itinerary);
  const user = useAppSelector((s) => s.auth.user);
  const [picked, setPicked] = useState<string[]>([]);
  const [detail, setDetail] = useState<ApiEvent | null>(null);
  const [timers, setTimers] = useState<number[]>([]);

  useEffect(() => {
    void dispatch(fetchVenues());
    void dispatch(fetchEvents(filters));
    return () => void dispatch(clearRoute());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  useEffect(() => {
    if (user) void dispatch(fetchItineraries());
  }, [dispatch, user]);

  const active = useMemo(
    () => mine.find((m) => m.id === activeId) ?? mine[0] ?? null,
    [mine, activeId],
  );

  const itineraryIds = useMemo(
    () => new Set((active?.items ?? []).map((i) => i.eventId)),
    [active],
  );

  const plannerEvents = useMemo(
    () => items.filter((e) => itineraryIds.has(e.id)),
    [items, itineraryIds],
  );

  useEffect(() => {
    setPicked((p) => p.filter((id) => itineraryIds.has(id)));
  }, [itineraryIds]);

  const pickedPastCount = useMemo(
    () => picked.filter((id) => {
      const ev = plannerEvents.find((e) => e.id === id) ?? items.find((e) => e.id === id);
      return ev ? isPast(ev.endsAt) : false;
    }).length,
    [picked, plannerEvents, items],
  );

  const detailPast = detail ? isPast(detail.endsAt) : false;

  const evById = useMemo(() => new Map(items.map((e) => [e.id, e])), [items]);
  const titleOf = (id: string | null) => {
    if (!id) return "Start";
    return evById.get(id)?.title ?? `${id.slice(0, 6)}…`;
  };
  const venueNameOf = (id: string | null) => {
    if (!id) return "";
    const ev = evById.get(id);
    return ev?.venue?.name ?? venues.find((v) => v.id === ev?.venueId)?.name ?? "";
  };
  const friendlyWarning = (w: string) =>
    w.replace(/"([^"]+)"/g, (_m, id: string) => `"${titleOf(id)}"`);
  const routeStopCount = route?.sequence.length ?? 0;
  const routeVenueCount = useMemo(() => {
    if (!route) return 0;
    return new Set(route.sequence.map((id) => evById.get(id)?.venueId).filter(Boolean)).size;
  }, [route, evById]);
  const sharedVenuePairs = useMemo(() => {
    if (!route) return [] as { fromIdx: number; toIdx: number; venue: string }[];
    const out: { fromIdx: number; toIdx: number; venue: string }[] = [];
    for (let i = 1; i < route.sequence.length; i++) {
      const a = evById.get(route.sequence[i - 1]);
      const b = evById.get(route.sequence[i]);
      if (a && b && a.venueId === b.venueId) {
        out.push({ fromIdx: i - 1, toIdx: i, venue: a.venue?.name ?? "the same venue" });
      }
    }
    return out;
  }, [route, evById]);

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function optimize() {
    if (picked.length < 2) {
      dispatch(pushToast({ title: "Select at least 2 events", kind: "warn" }));
      return;
    }
    if (pickedPastCount > 0) {
      dispatch(pushToast({
        title: "Includes past event(s)",
        body: `${pickedPastCount} selected event${pickedPastCount > 1 ? "s have" : " has"} already ended — still optimizing.`,
        kind: "warn",
      }));
    }
    await dispatch(optimizeItinerary({ eventIds: picked, includeEateries: true })).unwrap().catch(() => {
      dispatch(pushToast({ title: "Optimization failed", kind: "error" }));
    });
  }

  function remindToLeave(legIndex: number) {
    const leg = route?.legs[legIndex];
    if (!leg) return;
    const departIn = new Date(leg.departAt).getTime() - Date.now() - 15 * 60000;
    if (departIn <= 0) {
      dispatch(pushToast({ title: "Leave now!", body: `Head to your next event (arrive ${fmtTime(leg.arriveAt)}).`, kind: "warn" }));
      return;
    }
    if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission();
    const id = window.setTimeout(() => {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Time to leave", { body: `Leave now to arrive by ${fmtTime(leg.arriveAt)}.` });
      }
      dispatch(pushToast({ title: "Time to leave", body: `Arrive by ${fmtTime(leg.arriveAt)}.`, kind: "warn" }));
    }, Math.min(departIn, 2_147_483_647));
    setTimers((t) => [...t, id]);
    dispatch(pushToast({ title: "Reminder set", body: `We'll alert you 15 min before departure.`, kind: "info" }));
  }

  useEffect(() => () => timers.forEach(clearTimeout), [timers]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Campus map</h1>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
          {items.length} events on map · {plannerEvents.length} in your itinerary
        </p>
      </div>

      <MapView events={items} venues={venues} route={route} onEventClick={setDetail} />

      <Card aria-label="Route planner">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex items-center gap-1.5 text-[15px] font-semibold tracking-tight">
            <Navigation size={15} className="text-zinc-400" />
            Plan my route
            {picked.length > 0 && <Badge tone="brand">{picked.length} selected</Badge>}
          </h2>
          {user && mine.length > 1 && (
            <select
              value={active?.id ?? ""}
              onChange={(e) => dispatch(setActive(e.target.value || null))}
              className="field ml-auto !w-auto"
              aria-label="Choose itinerary for route planner"
            >
              {mine.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.items.length})
                </option>
              ))}
            </select>
          )}
        </div>

        {!user && (
          <p className="mt-3 rounded-xl bg-zinc-50 p-4 text-center text-sm text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
            <Link to="/login" className="font-semibold text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100">Log in</Link>
            {" "}and add events from Discover to plan a route.
          </p>
        )}

        {user && !active && (
          <p className="mt-3 rounded-xl bg-zinc-50 p-4 text-center text-sm text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
            No itinerary yet — add events from <Link to="/" className="font-semibold underline-offset-2 hover:underline">Discover</Link>.
          </p>
        )}

        {user && active && plannerEvents.length === 0 && (
          <p className="mt-3 rounded-xl bg-zinc-50 p-4 text-center text-sm text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
            <strong>{active.name}</strong> has no matching events. Add some from{" "}
            <Link to="/" className="font-semibold underline-offset-2 hover:underline">Discover</Link>.
          </p>
        )}

        {plannerEvents.length > 0 && (
          <div className="mt-3 grid max-h-64 gap-1.5 overflow-auto pr-0.5 md:grid-cols-2">
            {plannerEvents.map((e) => {
              const past = isPast(e.endsAt);
              const checked = picked.includes(e.id);
              return (
                <label
                  key={e.id}
                  title={past ? `${e.title} (ended)` : e.title}
                  className={`flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition ${
                    checked
                      ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800"
                      : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                  } ${past ? "opacity-55 grayscale" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(e.id)}
                    className="h-4 w-4 shrink-0 accent-zinc-900 dark:accent-white"
                    aria-label={past ? `${e.title} (ended)` : e.title}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="tabular-nums text-zinc-400">{fmtTime(e.startsAt)}</span>
                    {" · "}
                    {e.title}
                  </span>
                  {past && <Badge>Ended</Badge>}
                </label>
              );
            })}
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <Button variant="brand" onClick={optimize} disabled={routeStatus === "loading"}>
            <Footprints size={15} />
            {routeStatus === "loading" ? "Optimizing…" : "Optimize route"}
          </Button>
          <Button variant="ghost" onClick={() => { setPicked([]); dispatch(clearRoute()); }}>Clear</Button>
        </div>

        {route && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-semibold">
              {routeStopCount} stops · {routeVenueCount} venue{routeVenueCount === 1 ? "" : "s"} ·{" "}
              {route.totalTravelMin.toFixed(1)} min total
            </p>
            {routeStopCount !== picked.length && (
              <p className="flex gap-1.5 rounded-xl bg-red-50 p-2.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300" role="alert">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                Route covers {routeStopCount} of {picked.length} selected events — try re-selecting.
              </p>
            )}
            {sharedVenuePairs.map((p) => (
              <p key={`${p.fromIdx}-${p.toIdx}`} className="flex gap-1.5 rounded-xl bg-zinc-100 p-2.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300" role="note">
                <MapPin size={14} className="mt-0.5 shrink-0" />
                Stops {p.fromIdx + 1} → {p.toIdx + 1} share <strong>{p.venue}</strong> — no walk needed.
              </p>
            ))}
            {route.warnings.map((w, i) => (
              <p key={i} className="flex gap-1.5 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" role="alert">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />{friendlyWarning(w)}
              </p>
            ))}
            {route.eateryStops?.map((s) => (
              <p key={s.afterEventId} className="flex gap-1.5 rounded-xl bg-emerald-50 p-2.5 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                <UtensilsCrossed size={14} className="mt-0.5 shrink-0" />
                <span>{s.gapMin.toFixed(0)}-min gap after <strong>{titleOf(s.afterEventId)}</strong> — try <strong>{s.venueName}</strong>.</span>
              </p>
            ))}
            <ol className="space-y-1.5">
              {route.legs.map((leg, i) => {
                const toTitle = titleOf(leg.toEventId);
                const toVenue = venueNameOf(leg.toEventId);
                const fromEv = leg.fromEventId ? evById.get(leg.fromEventId) : undefined;
                const toEv = evById.get(leg.toEventId);
                const sameVenue = !!fromEv && !!toEv && fromEv.venueId === toEv.venueId;
                return (
                  <li key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 p-2.5 text-[13px] dark:border-zinc-800">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white dark:bg-white dark:text-zinc-900">{i + 1}</span>
                    {i === 0 ? (
                      <span><strong>{toTitle}</strong>{toVenue && <span className="text-zinc-400"> · {toVenue}</span>} — arrive by <strong className="tabular-nums">{fmtTime(leg.arriveAt)}</strong></span>
                    ) : (
                      <span>
                        <strong>{toTitle}</strong>{toVenue && <span className="text-zinc-400"> · {toVenue}</span>} —{" "}
                        <span className="tabular-nums">{fmtTime(leg.departAt)} → {fmtTime(leg.arriveAt)}</span>
                        {sameVenue
                          ? <span className="text-zinc-400"> · same venue</span>
                          : <span className="text-zinc-400"> · {leg.travelMin.toFixed(1)} min walk</span>}
                        {!leg.feasible && <strong className="text-red-600 dark:text-red-400"> · tight</strong>}
                      </span>
                    )}
                    {i > 0 && (
                      <button onClick={() => remindToLeave(i)} className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-zinc-800">
                        <Bell size={12} /> Remind me
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </Card>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-4 backdrop-blur-[2px] sm:items-center" onClick={() => setDetail(null)} role="dialog" aria-modal="true">
          <div className={`card w-full max-w-md p-5 shadow-pop ${detailPast ? "opacity-90" : ""}`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold tracking-tight">{detail.title}</h2>
              {detailPast && <Badge>Ended</Badge>}
              <button onClick={() => setDetail(null)} className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Close">
                <X size={15} />
              </button>
            </div>
            {detailPast && (
              <p className="mt-2 flex gap-1.5 rounded-xl bg-zinc-100 p-2 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" role="note">
                <Info size={13} className="mt-0.5 shrink-0" /> This event has already ended.
              </p>
            )}
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{detail.description}</p>
            <p className="mt-2 text-xs text-zinc-400">{detail.venue?.name} · {fmtTime(detail.startsAt)}–{fmtTime(detail.endsAt)}</p>
            <Button variant="ghost" onClick={() => setDetail(null)} className="mt-3 w-full">Close</Button>
          </div>
        </div>
      )}
    </div>
  );
}
