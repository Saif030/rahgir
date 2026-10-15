import { useEffect, useState } from "react";
import { CalendarPlus, CalendarX, Check, Clock, LayoutGrid, List, MapPin, Mic, Users, X, Zap } from "lucide-react";
import EventCard from "../components/EventCard";
import Filters from "../components/Filters";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchEvents, fetchVenues, setView } from "../store/eventsSlice";
import { addToItinerary, createItinerary, removeFromItinerary, setActive } from "../store/itinerarySlice";
import { addRegisteredEvent } from "../store/authSlice";
import { pushToast } from "../store/uiSlice";
import { api } from "../api/client";
import type { ApiEvent } from "../types";
import { fmtRange } from "../utils/format";

export default function Discovery() {
  const dispatch = useAppDispatch();
  const { items, total, status, view, filters } = useAppSelector((s) => s.events);
  const user = useAppSelector((s) => s.auth.user);
  const { mine, activeId } = useAppSelector((s) => s.itinerary);
  const registeredEventIds = useAppSelector((s) => s.auth.registeredEventIds);
  const [selected, setSelected] = useState<ApiEvent | null>(null);
  const [modalBusy, setModalBusy] = useState(false);

  const activeItinerary = mine.find((m) => m.id === activeId) ?? mine[0];
  const isSelectedAdded = selected && activeItinerary ? activeItinerary.items.some((i) => i.eventId === selected.id) : false;
  const isSelectedRegistered = selected ? registeredEventIds.includes(selected.id) : false;

  useEffect(() => {
    void dispatch(fetchVenues());
  }, [dispatch]);
  useEffect(() => {
    void dispatch(fetchEvents(filters));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  async function handleModalToggleItinerary() {
    if (!selected) return;
    if (!user) {
      dispatch(pushToast({ title: "Login required", body: "Log in to build an itinerary.", kind: "warn" }));
      return;
    }
    setModalBusy(true);
    try {
      let itId = activeItinerary?.id;
      if (!itId) {
        const created = await dispatch(createItinerary("My Schedule")).unwrap();
        itId = created.id;
      }
      if (isSelectedAdded) {
        await dispatch(removeFromItinerary({ itineraryId: itId, eventId: selected.id })).unwrap();
        dispatch(pushToast({ title: "Removed from itinerary", body: selected.title, kind: "info" }));
      } else {
        await dispatch(addToItinerary({ itineraryId: itId, eventId: selected.id })).unwrap();
        dispatch(pushToast({ title: "Added to itinerary", body: selected.title, kind: "info" }));
      }
    } catch {
      dispatch(pushToast({ title: isSelectedAdded ? "Could not remove event" : "Could not add event", kind: "error" }));
    } finally {
      setModalBusy(false);
    }
  }

  async function handleModalRegister() {
    if (!selected) return;
    if (!user) {
      dispatch(pushToast({ title: "Login required", body: "Log in to register in one click.", kind: "warn" }));
      return;
    }
    if (isSelectedRegistered) return;
    setModalBusy(true);
    try {
      await api.post(`/registrations/${selected.id}`, {});
      dispatch(addRegisteredEvent(selected.id));
      dispatch(pushToast({ title: "Registered", body: selected.title, kind: "info" }));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Registration failed";
      dispatch(pushToast({ title: msg, kind: "error" }));
    } finally {
      setModalBusy(false);
    }
  }

  const apply = () => void dispatch(fetchEvents(filters));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Discover events</h1>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            {total} event{total === 1 ? "" : "s"} · live availability
          </p>
        </div>
        {user && mine.length > 0 && (
          <div className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-zinc-500 dark:text-zinc-400 font-medium">Selected itinerary:</span>
            <select
              value={activeId ?? mine[0]?.id ?? ""}
              onChange={(e) => dispatch(setActive(e.target.value || null))}
              className="bg-transparent font-semibold text-zinc-900 outline-none dark:text-zinc-100 cursor-pointer"
              aria-label="Active itinerary selection"
            >
              {mine.map((m) => (
                <option key={m.id} value={m.id} className="dark:bg-zinc-900">
                  {m.name} ({m.items.length})
                </option>
              ))}
            </select>
          </div>
        )}
        <div
          className="ml-auto flex rounded-xl border border-zinc-200 bg-white p-0.5 dark:border-zinc-800 dark:bg-zinc-900"
          role="tablist"
          aria-label="View mode"
        >
          {(
            [
              { v: "grid" as const, icon: <LayoutGrid size={14} />, label: "Grid" },
              { v: "list" as const, icon: <List size={14} />, label: "List" },
            ]
          ).map(({ v, icon, label }) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => dispatch(setView(v))}
              className={`flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition ${
                view === v
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </div>

      <Filters onApply={apply} />

      {status === "loading" && (
        <div
          className={view === "grid" ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-3"}
          role="status"
          aria-label="Loading events"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card space-y-3">
              <div className="skeleton h-4 w-1/3" />
              <div className="skeleton h-5 w-3/4" />
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-3 w-2/3" />
            </div>
          ))}
        </div>
      )}

      {status !== "loading" && items.length === 0 && (
        <EmptyState
          icon={<CalendarX size={28} />}
          title="No events found"
          body="Try a different search term or clear your filters."
          action={<Button variant="ghost" onClick={apply}>Clear filters</Button>}
        />
      )}

      {status !== "loading" && items.length > 0 && (
        <div className={view === "grid" ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-3"}>
          {items.map((e) => (
            <EventCard key={e.id} event={e} onSelect={setSelected} />
          ))}
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-4 backdrop-blur-[2px] sm:items-center"
          onClick={() => setSelected(null)}
          role="dialog"
          aria-modal="true"
          aria-label={selected.title}
        >
          <div
            className="card max-h-[85vh] w-full max-w-lg overflow-auto !p-0 shadow-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 p-5 pb-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge>{selected.category}</Badge>
                <Badge tone={selected.availability === "full" ? "red" : selected.availability === "almost-full" ? "amber" : "green"}>
                  {selected.availability}
                </Badge>
                {selected.status !== "SCHEDULED" && <Badge tone="red">{selected.status}</Badge>}
              </div>
              <button
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
                onClick={() => setSelected(null)}
                aria-label="Close details"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 pt-3">
              <h2 className="text-lg font-bold tracking-tight">{selected.title}</h2>
              <p className="mt-0.5 text-xs text-zinc-400">{selected.difficulty}</p>
              <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                {selected.description}
              </p>
              <dl className="mt-4 space-y-2 border-t border-zinc-100 pt-4 text-sm dark:border-zinc-800">
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
                  <Clock size={14} className="shrink-0 text-zinc-400" />
                  {fmtRange(selected.startsAt, selected.endsAt)}
                </div>
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
                  <MapPin size={14} className="shrink-0 text-zinc-400" />
                  {selected.venue?.name} · {selected.venue?.building}
                </div>
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
                  <Users size={14} className="shrink-0 text-zinc-400" />
                  {selected.registeredCount}/{selected.capacity} registered · {selected.availability}
                </div>
                {selected.speakerName && (
                  <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
                    <Mic size={14} className="shrink-0 text-zinc-400" />
                    {selected.speakerName}
                    {selected.speakerBio ? <span className="text-zinc-400"> — {selected.speakerBio}</span> : null}
                  </div>
                )}
              </dl>
              <p className="mt-3 rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
                Setup {selected.planOut.setupMin ?? 15}m · buffer {selected.planOut.bufferMin ?? 15}m · teardown{" "}
                {selected.planOut.teardownMin ?? 10}m · Status: {selected.status}
              </p>
              <div className="mt-4 flex gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <button
                  disabled={modalBusy}
                  onClick={handleModalToggleItinerary}
                  className={`btn-ghost flex-1 !min-h-[38px] !text-[13px] ${
                    isSelectedAdded
                      ? "!border-brand-500/50 !bg-brand-50 !text-brand-700 hover:!bg-brand-100 dark:!border-brand-500/40 dark:!bg-brand-950/40 dark:!text-brand-300 dark:hover:!bg-brand-900/50 font-semibold"
                      : ""
                  }`}
                  title={isSelectedAdded ? `Added to ${activeItinerary?.name ?? "itinerary"} (click to remove)` : `Add to ${activeItinerary?.name ?? "itinerary"}`}
                >
                  {isSelectedAdded ? (
                    <>
                      <Check size={14} className="text-brand-600 dark:text-brand-400" />
                      Added
                    </>
                  ) : (
                    <>
                      <CalendarPlus size={14} />
                      Add
                    </>
                  )}
                </button>
                <button
                  disabled={modalBusy || isSelectedRegistered || selected.availability === "full"}
                  onClick={handleModalRegister}
                  className={`flex-1 !min-h-[38px] !text-[13px] ${
                    isSelectedRegistered
                      ? "inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-50 px-4 font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300 cursor-default"
                      : "btn-primary"
                  }`}
                >
                  {isSelectedRegistered ? (
                    <>
                      <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
                      Registered
                    </>
                  ) : selected.availability === "full" ? (
                    "Full"
                  ) : (
                    <>
                      <Zap size={14} /> Register
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
