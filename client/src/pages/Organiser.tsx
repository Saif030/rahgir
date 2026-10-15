import { useEffect, useState } from "react";
import { Megaphone, Pencil, Plus, Users, X } from "lucide-react";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { api } from "../api/client";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchEvents, fetchVenues } from "../store/eventsSlice";
import { pushToast } from "../store/uiSlice";
import type { ApiEvent, Venue } from "../types";
import { fmtTime } from "../utils/format";

const emptyForm = {
  title: "",
  description: "",
  category: "Tech",
  venueId: "",
  date: "",
  start: "10:00",
  end: "11:00",
  capacity: 100,
  difficulty: "Beginner",
  speakerName: "",
  speakerBio: "",
};

export default function Organiser() {
  const dispatch = useAppDispatch();
  const { items, venues, filters } = useAppSelector((s) => s.events);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<ApiEvent | null>(null);
  const [crowd, setCrowd] = useState({ venueId: "", density: 0.5 });
  const [broadcast, setBroadcast] = useState({ eventId: "", message: "" });

  useEffect(() => {
    void dispatch(fetchVenues());
    void dispatch(fetchEvents(filters));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      title: form.title,
      description: form.description,
      category: form.category,
      venueId: form.venueId || (venues as Venue[])[0]?.id,
      startsAt: new Date(`${form.date}T${form.start}:00`).toISOString(),
      endsAt: new Date(`${form.date}T${form.end}:00`).toISOString(),
      capacity: Number(form.capacity),
      difficulty: form.difficulty,
      speakerName: form.speakerName || undefined,
      speakerBio: form.speakerBio || undefined,
      planOut: { setupMin: 15, bufferMin: 15, teardownMin: 10 },
    };
    try {
      if (editing) {
        await api.put(`/events/${editing.id}`, body);
        dispatch(pushToast({ title: "Event updated", kind: "info" }));
        setEditing(null);
      } else {
        await api.post("/events", body);
        dispatch(pushToast({ title: "Event created", kind: "info" }));
      }
      setForm(emptyForm);
      void dispatch(fetchEvents(filters));
    } catch {
      dispatch(pushToast({ title: "Save failed — check all fields", kind: "error" }));
    }
  }

  async function setStatus(ev: ApiEvent, status: string) {
    try {
      await api.put(`/events/${ev.id}`, { status });
      dispatch(pushToast({ title: `Event ${status.toLowerCase()} — attendees notified`, kind: "info" }));
      void dispatch(fetchEvents(filters));
    } catch {
      dispatch(pushToast({ title: "Status update failed", kind: "error" }));
    }
  }

  async function postCrowd(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/crowd", { venueId: crowd.venueId || (venues as Venue[])[0]?.id, density: Number(crowd.density) });
      dispatch(pushToast({ title: "Crowd density published", kind: "info" }));
    } catch {
      dispatch(pushToast({ title: "Crowd update failed", kind: "error" }));
    }
  }

  async function sendBroadcast(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { data } = await api.post(`/registrations/${broadcast.eventId}/broadcast`, { message: broadcast.message });
      dispatch(pushToast({ title: `Broadcast sent to ${data.recipients} registrants (${data.provider})`, kind: "info" }));
      setBroadcast({ eventId: "", message: "" });
    } catch {
      dispatch(pushToast({ title: "Broadcast failed", kind: "error" }));
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Organiser dashboard</h1>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{items.length} events · manage schedule</p>
      </div>

      <Card>
        <h2 className="flex items-center gap-1.5 text-[15px] font-semibold tracking-tight">
          {editing ? <Pencil size={15} className="text-zinc-400" /> : <Plus size={15} className="text-zinc-400" />}
          {editing ? "Edit event" : "New event"}
        </h2>
        <form onSubmit={submit} className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <input value={form.title} onChange={set("title")} required placeholder="Title" aria-label="Title" className="field" />
          <select value={form.category} onChange={set("category")} aria-label="Category" className="field">
            {["Tech", "Design", "Business", "Networking", "Wellness"].map((c) => <option key={c}>{c}</option>)}
          </select>
          <select value={form.venueId} onChange={set("venueId")} aria-label="Venue" className="field">
            <option value="">Select venue…</option>
            {(venues as Venue[]).map((v) => <option key={v.id} value={v.id}>{v.name} ({v.building})</option>)}
          </select>
          <textarea value={form.description} onChange={set("description")} required placeholder="Description" aria-label="Description" className="field min-h-[44px] py-2.5 sm:col-span-2 lg:col-span-3" />
          <input type="date" value={form.date} onChange={set("date")} required aria-label="Date" className="field" />
          <input type="time" value={form.start} onChange={set("start")} required aria-label="Start time" className="field" />
          <input type="time" value={form.end} onChange={set("end")} required aria-label="End time" className="field" />
          <input type="number" value={form.capacity} onChange={set("capacity")} min={1} placeholder="Capacity" aria-label="Capacity" className="field" />
          <select value={form.difficulty} onChange={set("difficulty")} aria-label="Difficulty" className="field">
            {["Beginner", "Intermediate", "Advanced"].map((d) => <option key={d}>{d}</option>)}
          </select>
          <input value={form.speakerName} onChange={set("speakerName")} placeholder="Speaker name" aria-label="Speaker name" className="field" />
          <input value={form.speakerBio} onChange={set("speakerBio")} placeholder="Speaker bio" aria-label="Speaker bio" className="field sm:col-span-2" />
          <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
            <Button variant="brand" type="submit">{editing ? "Save changes" : "Create event"}</Button>
            {editing && (
              <Button variant="ghost" type="button" onClick={() => { setEditing(null); setForm(emptyForm); }}>
                <X size={14} /> Cancel
              </Button>
            )}
          </div>
        </form>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="flex items-center gap-1.5 text-[15px] font-semibold tracking-tight">
            <Users size={15} className="text-zinc-400" /> Crowd level
          </h2>
          <form onSubmit={postCrowd} className="mt-3 flex flex-wrap items-center gap-2.5">
            <select value={crowd.venueId} onChange={(e) => setCrowd((c) => ({ ...c, venueId: e.target.value }))} aria-label="Venue" className="field !w-auto flex-1">
              <option value="">Venue…</option>
              {(venues as Venue[]).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <input type="range" min={0} max={1} step={0.05} value={crowd.density} onChange={(e) => setCrowd((c) => ({ ...c, density: Number(e.target.value) }))} aria-label="Crowd density" className="accent-zinc-900 dark:accent-white" />
            <span className="text-sm font-semibold tabular-nums">{Math.round(crowd.density * 100)}%</span>
            <Button variant="primary" type="submit" className="!min-h-[38px]">Publish</Button>
          </form>
        </Card>
        <Card>
          <h2 className="flex items-center gap-1.5 text-[15px] font-semibold tracking-tight">
            <Megaphone size={15} className="text-zinc-400" /> Broadcast
          </h2>
          <p className="mt-0.5 text-xs text-zinc-400">Notify all registrants of an event.</p>
          <form onSubmit={sendBroadcast} className="mt-3 flex flex-col gap-2">
            <select value={broadcast.eventId} onChange={(e) => setBroadcast((b) => ({ ...b, eventId: e.target.value }))} required aria-label="Event" className="field">
              <option value="">Select event…</option>
              {items.slice(0, 50).map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
            <input value={broadcast.message} onChange={(e) => setBroadcast((b) => ({ ...b, message: e.target.value }))} required placeholder="Message, e.g. Room changed to B-204" aria-label="Message" className="field" />
            <Button variant="ghost" type="submit">Send broadcast</Button>
          </form>
        </Card>
      </section>

      <Card>
        <h2 className="text-[15px] font-semibold tracking-tight">All events ({items.length})</h2>
        <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
          {items.slice(0, 60).map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
              <Badge tone={e.status !== "SCHEDULED" ? "red" : "neutral"}>{e.status}</Badge>
              <span className="min-w-0 flex-1 truncate text-zinc-600 dark:text-zinc-300">
                <span className="tabular-nums text-zinc-400">{fmtTime(e.startsAt)}</span> · {e.title}{" "}
                <span className="text-zinc-400">· {e.registeredCount}/{e.capacity}</span>
              </span>
              <button onClick={() => { setEditing(e); setForm({ ...emptyForm, title: e.title, description: e.description, category: e.category, venueId: e.venueId, capacity: e.capacity, difficulty: e.difficulty, speakerName: e.speakerName ?? "", speakerBio: e.speakerBio ?? "" }); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-zinc-800">Edit</button>
              {e.status !== "CANCELLED" ? (
                <button onClick={() => void setStatus(e, "CANCELLED")} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/40">Cancel</button>
              ) : (
                <button onClick={() => void setStatus(e, "SCHEDULED")} className="rounded-lg px-2.5 py-1.5 text-xs font-medium transition hover:bg-zinc-100 dark:hover:bg-zinc-800">Restore</button>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
