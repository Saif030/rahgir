import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Compass, UserPlus } from "lucide-react";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { register } from "../store/authSlice";

export default function Register() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { status, error } = useAppSelector((s) => s.auth);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "ATTENDEE" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await dispatch(register(form));
    if (res.meta.requestStatus === "fulfilled") navigate("/");
  }

  return (
    <div className="mx-auto max-w-sm pt-6">
      <div className="mb-5 text-center">
        <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
          <Compass size={20} />
        </span>
        <h1 className="mt-3 text-xl font-bold tracking-tight">Create account</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Discover events in seconds</p>
      </div>
      <Card>
        <form onSubmit={submit} className="space-y-3">
          <label className="label block">
            Name
            <input value={form.name} onChange={set("name")} required autoComplete="name" className="field mt-1.5" />
          </label>
          <label className="label block">
            Email
            <input value={form.email} onChange={set("email")} type="email" required autoComplete="email" className="field mt-1.5" />
          </label>
          <label className="label block">
            Password (min 8 chars)
            <input value={form.password} onChange={set("password")} type="password" minLength={8} required autoComplete="new-password" className="field mt-1.5" />
          </label>
          <label className="label block">
            I am a…
            <select value={form.role} onChange={set("role")} className="field mt-1.5">
              <option value="ATTENDEE">Attendee</option>
              <option value="ORGANISER">Event organiser</option>
            </select>
          </label>
          {error && <p className="text-[13px] text-red-600 dark:text-red-400" role="alert">{error}</p>}
          <Button variant="brand" type="submit" disabled={status === "loading"} className="w-full">
            <UserPlus size={15} />
            {status === "loading" ? "Creating…" : "Sign up"}
          </Button>
        </form>
        <p className="mt-3 text-center text-sm text-zinc-500">
          Have an account? <Link to="/login" className="font-semibold text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100">Log in</Link>
        </p>
      </Card>
    </div>
  );
}
