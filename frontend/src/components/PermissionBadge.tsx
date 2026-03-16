import React from "react";

const PERMISSION_DEFS = [
  {
    bit: 1 << 0,
    label: "READ",
    emoji: "👁️",
    className:
      "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  },
  {
    bit: 1 << 1,
    label: "CREATE",
    emoji: "✏️",
    className: "bg-blue-500/15 text-blue-300 border border-blue-500/30",
  },
  {
    bit: 1 << 2,
    label: "UPDATE",
    emoji: "🔄",
    className:
      "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  },
  {
    bit: 1 << 3,
    label: "DELETE",
    emoji: "🗑️",
    className: "bg-rose-500/15 text-rose-300 border border-rose-500/30",
  },
  {
    bit: 1 << 4,
    label: "ADMIN",
    emoji: "👑",
    className:
      "bg-violet-500/15 text-violet-300 border border-violet-500/30",
  },
];

interface PermissionBadgeProps {
  permissions: number;
}

export function PermissionBadge({ permissions }: PermissionBadgeProps) {
  const active = PERMISSION_DEFS.filter((p) => (permissions & p.bit) === p.bit);

  if (active.length === 0) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-500 border border-slate-700">
        No Permissions
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {active.map((p) => (
        <span
          key={p.label}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide ${p.className}`}
        >
          <span>{p.emoji}</span>
          {p.label}
        </span>
      ))}
    </div>
  );
}
