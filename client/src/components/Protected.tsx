import { Navigate } from "react-router-dom";
import type { JSX } from "react";
import { useAppSelector } from "../store/hooks";

export default function Protected({ children, roles }: { children: JSX.Element; roles?: string[] }) {
  const user = useAppSelector((s) => s.auth.user);
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}
