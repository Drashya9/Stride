import { StatusIcon, PriorityIcon } from "@/components/icons";
import { PRIORITY_STYLE, ROLE_STYLE, STATUS_STYLE } from "@/lib/colors";
import { PRIORITY_LABEL, STATUS_LABEL, type Priority, type Role, type Status } from "@/lib/constants";
import { cn, initials } from "@/lib/utils";

export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 font-bold text-white shadow-sm",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.5 }}
      aria-hidden
    >
      S
    </span>
  );
}

/** Colored square with the workspace key, e.g. "CAP". Hue is derived from the key. */
export function WorkspaceTile({ keyText, size = 28 }: { keyText: string; size?: number }) {
  const hue = [...keyText].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 11);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-lg font-mono font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.34, background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 40) % 360} 70% 45%))` }}
    >
      {keyText.slice(0, 4)}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-[12px] font-medium", s.soft, s.text, className)}>
      <StatusIcon status={status} size={13} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function PriorityBadge({ priority, compact = false }: { priority: Priority; compact?: boolean }) {
  const p = PRIORITY_STYLE[priority];
  return (
    <span
      title={`Priority: ${PRIORITY_LABEL[priority]}`}
      className={cn("inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium", p.soft, p.text)}
    >
      <PriorityIcon priority={priority} size={12} />
      {!compact && PRIORITY_LABEL[priority]}
    </span>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      title={ROLE_STYLE[role].hint}
      className={cn("inline-flex h-5 items-center rounded-full px-2 text-[11px] font-semibold capitalize", ROLE_STYLE[role].badge)}
    >
      {role}
    </span>
  );
}

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-subtle px-1 font-sans text-[11px] text-muted",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/** Renders "mod+k" as ⌘K / Ctrl K, and "g b" as two keys. */
export function Keys({ combo }: { combo: string }) {
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const label = (k: string) =>
    ({ mod: isMac ? "⌘" : "Ctrl", shift: "⇧", enter: "↵", escape: "Esc", backspace: "⌫" })[k] ?? k.toUpperCase();
  return (
    <span className="inline-flex items-center gap-0.5">
      {combo.split(" ").map((step, i) => (
        <span key={i} className="inline-flex gap-0.5">
          {step.split("+").map((k) => (
            <Kbd key={k}>{label(k)}</Kbd>
          ))}
        </span>
      ))}
    </span>
  );
}

export function Avatar({
  name,
  email,
  image,
  size = 20,
}: {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  size?: number;
}) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt={name ?? ""} width={size} height={size} className="rounded-full" style={{ width: size, height: size }} />;
  }
  const hue = [...(email ?? name ?? "?")].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <span
      title={name ?? email ?? undefined}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.42, background: `hsl(${hue} 55% 48%)` }}
    >
      {initials(name, email)}
    </span>
  );
}

export function LabelChip({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex h-5 items-center gap-1 rounded-full px-1.5 text-[11px] font-medium text-fg"
      style={{ background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {name}
    </span>
  );
}
