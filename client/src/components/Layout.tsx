import { useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { AlertTriangle, Compass, Info, XCircle } from "lucide-react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { logout } from "../store/authSlice";
import { dismissToast } from "../store/uiSlice";
import { useRealtime } from "../realtime";
import { playNotificationPing } from "../utils/sound";
import ThemeToggle from "./ui/ThemeToggle";

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
    isActive
      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
      : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
  }`;

const toastIcon = {
  info: <Info size={15} className="mt-0.5 shrink-0 text-brand-500" />,
  warn: <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" />,
  error: <XCircle size={15} className="mt-0.5 shrink-0 text-red-500" />,
} as const;

export default function Layout() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const toasts = useAppSelector((s) => s.ui.toasts);
  const lastToastIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (toasts.length > 0) {
      const latest = toasts[toasts.length - 1];
      if (latest && latest.id !== lastToastIdRef.current) {
        lastToastIdRef.current = latest.id;
        playNotificationPing();
      }
    }
  }, [toasts]);

  useRealtime();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/80 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link to="/" className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
              <Compass size={16} />
            </span>
            Rahgir
          </Link>
          <nav className="ml-2 hidden items-center gap-0.5 md:flex" aria-label="Primary">
            <NavLink to="/" className={linkCls} end>Discover</NavLink>
            <NavLink to="/map" className={linkCls}>Map</NavLink>
            <NavLink to="/itineraries" className={linkCls}>Itineraries</NavLink>
            {(user?.role === "ORGANISER" || user?.role === "ADMIN") && (
              <NavLink to="/organiser" className={linkCls}>Organiser</NavLink>
            )}
            <NavLink to="/ar" className={linkCls}>AR</NavLink>
          </nav>
          {/* Mobile nav */}
          <nav className="ml-2 flex items-center gap-0.5 md:hidden" aria-label="Primary mobile">
            <NavLink to="/" className={linkCls} end>Discover</NavLink>
            <NavLink to="/map" className={linkCls}>Map</NavLink>
            <NavLink to="/itineraries" className={linkCls}>Plans</NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <>
                <span
                  className="hidden items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 lg:flex"
                  title={user.role}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  {user.name}
                </span>
                <button
                  className="rounded-xl border border-zinc-200 px-3 py-1.5 text-sm font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  onClick={() => void dispatch(logout()).then(() => navigate("/"))}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-xl px-3 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Log in
                </Link>
                <Link to="/register" className="btn-primary !min-h-[36px] !px-3.5 !text-[13px]">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <div
        className="pointer-events-none fixed right-4 top-16 z-50 flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="card pointer-events-auto flex gap-2 !p-3 shadow-pop"
          >
            {toastIcon[t.kind]}
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold leading-tight">{t.title}</p>
              {t.body && <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">{t.body}</p>}
            </div>
            <button
              className="text-zinc-400 transition hover:text-zinc-700 dark:hover:text-zinc-200"
              aria-label="Dismiss notification"
              onClick={() => dispatch(dismissToast(t.id))}
            >
              <XCircle size={15} />
            </button>
          </div>
        ))}
      </div>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
