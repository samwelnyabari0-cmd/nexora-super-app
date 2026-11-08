import type { ReactNode } from "react";
import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

export function Avatar({
  name,
  hue = 295,
  size = 40,
  ring,
}: {
  name: string;
  hue?: number;
  size?: number;
  ring?: boolean;
}) {
  const initials = name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const inner = (
    <span
      aria-hidden
      className="grid place-items-center rounded-full font-display font-semibold text-foreground"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(135deg, oklch(0.55 0.2 ${hue}), oklch(0.35 0.12 ${hue + 40}))`,
      }}
    >
      {initials}
    </span>
  );
  return ring ? (
    <span className="ring-brand inline-block rounded-full">
      <span className="block rounded-full bg-background p-[2px]">{inner}</span>
    </span>
  ) : (
    inner
  );
}

export function DemoBadge({
  children = "Demo",
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-warning",
        className,
      )}
    >
      <FlaskConical className="h-3 w-3" aria-hidden /> {children}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-5 flex items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed p-10 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-muted text-accent">
        {icon}
      </div>
      <p className="font-display font-semibold">{title}</p>
      {body && <p className="mt-1 max-w-xs text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Chip({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition",
        active
          ? "border-transparent bg-foreground text-background"
          : "bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn("rounded-2xl border bg-card p-4 md:p-5", className)}>{children}</section>
  );
}
