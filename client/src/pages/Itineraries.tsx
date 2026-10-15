import { useEffect, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, CalendarPlus, Download, GripVertical, Info, Sparkles, Trash2 } from "lucide-react";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  createItinerary,
  fetchItineraries,
  optimizeItinerary,
  removeFromItinerary,
  reorderItinerary,
  setActive,
} from "../store/itinerarySlice";
import { pushToast } from "../store/uiSlice";
import { fmtTime } from "../utils/format";

export default function Itineraries() {
  const dispatch = useAppDispatch();
  const { mine, activeId, route } = useAppSelector((s) => s.itinerary);
  const [name, setName] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    void dispatch(fetchItineraries());
  }, [dispatch]);

  const active = mine.find((m) => m.id === activeId) ?? mine[0];

  async function create() {
    if (!name.trim()) return;
    await dispatch(createItinerary(name.trim())).unwrap().catch(() =>
      dispatch(pushToast({ title: "Could not create itinerary", kind: "error" })),
    );
    setName("");
  }

  async function move(eventId: string, dir: -1 | 1) {
    if (!active) return;
    const order = [...active.items].sort((a, b) => a.order - b.order).map((i) => i.eventId);
    const idx = order.indexOf(eventId);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= order.length) return;
    [order[idx], order[j]] = [order[j], order[idx]];
    await dispatch(reorderItinerary({ itineraryId: active.id, order })).unwrap();
  }

  async function dropOn(targetEventId: string) {
    if (!active || !dragId || dragId === targetEventId) return;
    const order = [...active.items].sort((a, b) => a.order - b.order).map((i) => i.eventId);
    const from = order.indexOf(dragId);
    const to = order.indexOf(targetEventId);
    if (from < 0 || to < 0) return;
    order.splice(to, 0, ...order.splice(from, 1));
    setDragId(null);
    await dispatch(reorderItinerary({ itineraryId: active.id, order })).unwrap();
  }

  function downloadIcs() {
    if (!active) return;
    const url = `${import.meta.env.VITE_API_URL ?? "http://localhost:4000"}/api/itineraries/${active.id}/export.ics`;
    const a = document.createElement("a");
    a.href = url;
    void fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem("er_access") ?? ""}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const obj = URL.createObjectURL(blob);
        a.href = obj;
        a.download = `${active.name}.ics`;
        a.click();
        URL.revokeObjectURL(obj);
      });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">My itineraries</h1>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
          {mine.length} plan{mine.length === 1 ? "" : "s"} · drag to reorder
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void create()}
          placeholder='New itinerary, e.g. "Friday Schedule"'
          aria-label="New itinerary name"
          className="field min-w-0 flex-1"
        />
        <Button variant="primary" onClick={create}>
          <CalendarPlus size={15} /> Create
        </Button>
      </div>

      {mine.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Itineraries">
          {mine.map((m) => {
            const selected = m.id === active?.id;
            return (
              <button
                key={m.id}
                role="tab"
                aria-selected={selected}
                onClick={() => dispatch(setActive(m.id))}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
                  selected
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                    : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {m.name} · {m.items.length}
              </button>
            );
          })}
        </div>
      )}

      {!active && (
        <EmptyState
          icon={<CalendarPlus size={28} />}
          title="No itineraries yet"
          body="Create one above, then add events from Discover."
        />
      )}

      {active && (
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-semibold tracking-tight">{active.name}</h2>
            <Badge tone="neutral">{active.totalMin.toFixed(0)} min</Badge>
            <div className="ml-auto flex gap-2">
              <Button
                variant="primary"
                className="!min-h-[38px] !text-[13px]"
                onClick={() => void dispatch(optimizeItinerary({ eventIds: active.items.map((i) => i.eventId), includeEateries: true }))}
              >
                <Sparkles size={14} /> Optimize
              </Button>
              <Button variant="ghost" className="!min-h-[38px] !text-[13px]" onClick={downloadIcs}>
                <Download size={14} /> .ics
              </Button>
            </div>
          </div>

          {active.conflicts.length > 0 && (
            <div className="mt-3 flex gap-1.5 rounded-xl bg-red-50 p-2.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300" role="alert">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{active.conflicts.length} overlapping conflict(s) — consider moving one.</span>
            </div>
          )}

          {route && (
            <div className="mt-2 flex gap-1.5 rounded-xl bg-blue-50 p-2.5 text-xs text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
              <Info size={14} className="mt-0.5 shrink-0" />
              <span>
                Suggested order: {route.sequence.map((s) => s.slice(0, 6)).join(" → ")} ·{" "}
                {route.totalTravelMin.toFixed(1)} min walk
              </span>
            </div>
          )}

          <ol className="mt-3 space-y-1.5">
            {[...active.items].sort((a, b) => a.order - b.order).map((item, idx) => (
              <li
                key={item.id}
                draggable
                onDragStart={() => setDragId(item.eventId)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => void dropOn(item.eventId)}
                className={`flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-white p-2.5 transition dark:border-zinc-800 dark:bg-zinc-900 ${dragId === item.eventId ? "opacity-50" : ""}`}
                title="Drag to reorder"
              >
                <GripVertical size={14} className="shrink-0 cursor-grab text-zinc-300 dark:text-zinc-600" />
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold tabular-nums text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.event.title}</p>
                  <p className="truncate text-xs tabular-nums text-zinc-400">
                    {fmtTime(item.event.startsAt)}–{fmtTime(item.event.endsAt)} · {item.event.venue?.name}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => void move(item.eventId, -1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800" aria-label="Move earlier">
                    <ArrowUp size={14} />
                  </button>
                  <button onClick={() => void move(item.eventId, 1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800" aria-label="Move later">
                    <ArrowDown size={14} />
                  </button>
                  <button
                    onClick={() => void dispatch(removeFromItinerary({ itineraryId: active.id, eventId: item.eventId }))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                    aria-label={`Remove ${item.event.title}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ol>

          {active.gaps.length > 0 && (
            <p className="mt-3 text-xs tabular-nums text-zinc-400">
              Gaps: {active.gaps.map((g) => `${g.gapMin.toFixed(0)}m`).join(" · ")}
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
