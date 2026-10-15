import { useState } from "react";
import { ChevronDown, RotateCcw, Search } from "lucide-react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { setFilters } from "../store/eventsSlice";

const CATS = ["", "Tech", "Design", "Business", "Networking", "Wellness"];

export default function Filters({ onApply }: { onApply: () => void }) {
  const dispatch = useAppDispatch();
  const f = useAppSelector((s) => s.events.filters);
  const [expanded, setExpanded] = useState(false);
  const set = (patch: Partial<typeof f>) => dispatch(setFilters(patch));

  const hasActive = f.search || f.category || f.date || f.time || f.capacity || f.difficulty;

  return (
    <div className="card !p-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onApply();
        }}
        className="flex flex-col gap-2.5"
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={f.search}
              onChange={(e) => set({ search: e.target.value })}
              placeholder="Search events, speakers, venues…"
              aria-label="Search events"
              className="field !pl-9"
            />
          </div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="btn-ghost !px-3"
          >
            Filters
            <ChevronDown size={14} className={`transition ${expanded ? "rotate-180" : ""}`} />
          </button>
          <button type="submit" className="btn-primary hidden sm:inline-flex">
            Search
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Category">
          {CATS.map((c) => {
            const active = f.category === c;
            return (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  set({ category: c });
                  // auto-apply category for snappy UX
                  setTimeout(onApply, 0);
                }}
                className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition ${
                  active
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                {c === "" ? "All" : c}
              </button>
            );
          })}
          {hasActive && (
            <button
              type="button"
              onClick={() => {
                dispatch(setFilters({ search: "", category: "", date: "", time: "", capacity: "", difficulty: "" }));
                setTimeout(onApply, 0);
              }}
              className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-[13px] font-medium text-zinc-400 transition hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              <RotateCcw size={12} /> Reset
            </button>
          )}
        </div>

        {expanded && (
          <div className="grid grid-cols-2 gap-2 border-t border-zinc-100 pt-2.5 dark:border-zinc-800 sm:grid-cols-4">
            <label className="label flex flex-col gap-1">
              Date
              <input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} className="field" />
            </label>
            <label className="label flex flex-col gap-1">
              Time
              <input type="time" value={f.time} onChange={(e) => set({ time: e.target.value })} className="field" />
            </label>
            <label className="label flex flex-col gap-1">
              Availability
              <select value={f.capacity} onChange={(e) => set({ capacity: e.target.value })} className="field">
                <option value="">Any</option>
                <option value="available">Available only</option>
              </select>
            </label>
            <div className="flex items-end gap-2">
              <button type="submit" className="btn-primary flex-1">
                Apply
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
