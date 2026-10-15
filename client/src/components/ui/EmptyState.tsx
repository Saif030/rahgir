import type { ReactNode } from "react";

export default function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      {icon && <div className="mb-3 text-zinc-400 dark:text-zinc-500">{icon}</div>}
      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
