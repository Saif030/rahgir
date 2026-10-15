import { useState } from "react";
import { CalendarPlus, Check, Clock, MapPin, Mic, Zap } from "lucide-react";
import { api } from "../api/client";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { addToItinerary, createItinerary, removeFromItinerary } from "../store/itinerarySlice";
import { addRegisteredEvent } from "../store/authSlice";
import { pushToast } from "../store/uiSlice";
import { colorFor, type ApiEvent } from "../types";
import { fmtRange } from "../utils/format";
import Badge from "./ui/Badge";

const AVAIL_TONE: Record<string, "green" | "amber" | "red"> = {
  available: "green",
  "almost-full": "amber",
  full: "red",
};

export default function EventCard({ event, onSelect }: { event: ApiEvent; onSelect?: (e: ApiEvent) => void }) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const itineraries = useAppSelector((s) => s.itinerary.mine);
  const activeId = useAppSelector((s) => s.itinerary.activeId);
  const registeredEventIds = useAppSelector((s) => s.auth.registeredEventIds);
  const [busy, setBusy] = useState(false);

  const activeItinerary = itineraries.find((m) => m.id === activeId) ?? itineraries[0];
  const isAdded = activeItinerary ? activeItinerary.items.some((item) => item.eventId === event.id) : false;
  const isRegistered = registeredEventIds.includes(event.id);

  const buffer = event.planOut.bufferMin ?? 15;

  async function handleToggleItinerary() {
    if (!user) {
      dispatch(pushToast({ title: "Login required", body: "Log in to build an itinerary.", kind: "warn" }));
      return;
    }
    setBusy(true);
    try {
      let itId = activeItinerary?.id;
      if (!itId) {
        const created = await dispatch(createItinerary("My Schedule")).unwrap();
        itId = created.id;
      }
      if (isAdded) {
        await dispatch(removeFromItinerary({ itineraryId: itId, eventId: event.id })).unwrap();
        dispatch(pushToast({ title: "Removed from itinerary", body: event.title, kind: "info" }));
      } else {
        await dispatch(addToItinerary({ itineraryId: itId, eventId: event.id })).unwrap();
        dispatch(pushToast({ title: "Added to itinerary", body: event.title, kind: "info" }));
      }
    } catch {
      dispatch(pushToast({ title: isAdded ? "Could not remove event" : "Could not add event", kind: "error" }));
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister() {
    if (!user) {
      dispatch(pushToast({ title: "Login required", body: "Log in to register in one click.", kind: "warn" }));
      return;
    }
    if (isRegistered) return;
    setBusy(true);
    try {
      await api.post(`/registrations/${event.id}`, {});
      dispatch(addRegisteredEvent(event.id));
      dispatch(pushToast({ title: "Registered", body: event.title, kind: "info" }));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Registration failed";
      dispatch(pushToast({ title: msg, kind: "error" }));
    } finally {
      setBusy(false);
    }
  }

  const pct = event.capacity > 0 ? Math.min(100, Math.round((event.registeredCount / event.capacity) * 100)) : 0;

  return (
    <article className="card group flex flex-col p-4 transition hover:shadow-pop">
      <div className="flex items-center gap-1.5">
        <Badge dot={colorFor(event.category)}>{event.category}</Badge>
        <Badge tone={AVAIL_TONE[event.availability]}>
          {event.availability === "full" ? "Full" : event.availability === "almost-full" ? "Almost full" : "Available"}
        </Badge>
        {event.status !== "SCHEDULED" && <Badge tone="red">{event.status}</Badge>}
        <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500">{event.difficulty}</span>
      </div>

      <h3 className="mt-2.5 text-[15px] font-semibold leading-snug tracking-tight">
        <button className="text-left transition hover:text-brand-600 dark:hover:text-brand-200" onClick={() => onSelect?.(event)}>
          {event.title}
        </button>
      </h3>
      <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        {event.description}
      </p>

      <div className="mt-3 space-y-1.5 text-[13px] text-zinc-600 dark:text-zinc-300">
        <div className="flex items-center gap-1.5">
          <Clock size={13} className="shrink-0 text-zinc-400" />
          <span className="truncate">{fmtRange(event.startsAt, event.endsAt)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin size={13} className="shrink-0 text-zinc-400" />
          <span className="truncate">
            {event.venue?.name ?? "TBA"}
            {event.venue ? <span className="text-zinc-400"> · {event.venue.building}</span> : ""}
          </span>
        </div>
        {event.speakerName && (
          <div className="flex items-center gap-1.5">
            <Mic size={13} className="shrink-0 text-zinc-400" />
            <span className="truncate">{event.speakerName}</span>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2" aria-label={`Capacity ${pct} percent`}>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100" style={{ width: `${pct}%` }} />
        </div>
        <p className="shrink-0 text-[11px] tabular-nums text-zinc-400">
          {event.registeredCount}/{event.capacity}
        </p>
      </div>

      <div className="mt-3 flex gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <button
          disabled={busy}
          onClick={handleToggleItinerary}
          className={`btn-ghost flex-1 !min-h-[38px] !text-[13px] ${
            isAdded
              ? "!border-brand-500/50 !bg-brand-50 !text-brand-700 hover:!bg-brand-100 dark:!border-brand-500/40 dark:!bg-brand-950/40 dark:!text-brand-300 dark:hover:!bg-brand-900/50 font-semibold"
              : ""
          }`}
          title={isAdded ? `Added to ${activeItinerary?.name ?? "itinerary"} (click to remove)` : `Add to ${activeItinerary?.name ?? "itinerary"}`}
        >
          {isAdded ? (
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
          disabled={busy || isRegistered || event.availability === "full"}
          onClick={handleRegister}
          className={`flex-1 !min-h-[38px] !text-[13px] ${
            isRegistered
              ? "inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-50 px-4 font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300 cursor-default"
              : "btn-primary"
          }`}
        >
          {isRegistered ? (
            <>
              <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
              Registered
            </>
          ) : event.availability === "full" ? (
            "Full"
          ) : (
            <>
              <Zap size={14} /> Register
            </>
          )}
        </button>
      </div>
      <p className="mt-2 flex items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-500">
        <Check size={11} />
        {buffer} min buffer included
      </p>
    </article>
  );
}
