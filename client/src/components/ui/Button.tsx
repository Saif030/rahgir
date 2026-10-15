import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "brand" | "ghost" | "danger-ghost";

const styles: Record<Variant, string> = {
  primary: "btn-primary",
  brand: "btn-brand",
  ghost: "btn-ghost",
  "danger-ghost":
    "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-red-200 px-4 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export default function Button({ variant = "primary", className = "", ...rest }: Props) {
  return <button className={`${styles[variant]} ${className}`} {...rest} />;
}
