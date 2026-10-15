import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Compass, LogIn } from "lucide-react";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { login } from "../store/authSlice";

export default function Login() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { status, error } = useAppSelector((s) => s.auth);
  const [email, setEmail] = useState("attendee@test.com");
  const [password, setPassword] = useState("Password123!");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await dispatch(login({ email, password }));
    if (res.meta.requestStatus === "fulfilled") navigate("/");
  }

  return (
    <div className="mx-auto max-w-sm pt-6">
      <div className="mb-5 text-center">
        <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
          <Compass size={20} />
        </span>
        <h1 className="mt-3 text-xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Log in to plan your day</p>
      </div>
      <Card>
        <form onSubmit={submit} className="space-y-3">
          <label className="label block">
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="email" className="field mt-1.5" />
          </label>
          <label className="label block">
            Password
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required autoComplete="current-password" className="field mt-1.5" />
          </label>
          {error && <p className="text-[13px] text-red-600 dark:text-red-400" role="alert">{error}</p>}
          <Button variant="brand" type="submit" disabled={status === "loading"} className="w-full">
            <LogIn size={15} />
            {status === "loading" ? "Logging in…" : "Log in"}
          </Button>
        </form>
        <p className="mt-4 rounded-xl bg-zinc-50 px-3 py-2 text-center text-xs text-zinc-400 dark:bg-zinc-800/60">
          Demo: attendee@test.com · Password123!
        </p>
        <p className="mt-3 text-center text-sm text-zinc-500">
          No account? <Link to="/register" className="font-semibold text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100">Sign up</Link>
        </p>
      </Card>
    </div>
  );
}
