interface LogoProps {
  size?: number;
  className?: string;
}

/**
 * DagerBooks mark: the KM 0 interchange with three lines leaving it.
 * Same drawing as app/icon.svg (the favicon); keep both in sync.
 */
export function Logo({ size = 28, className }: LogoProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="5" style={{ fill: "var(--enamel-950)" }} />
      <path d="M16 16V2.5" style={{ stroke: "var(--ink-a)" }} strokeWidth="4.5" />
      <path d="M16 16h13.5" style={{ stroke: "var(--ink-b)" }} strokeWidth="4.5" />
      <path d="M16 16L5.5 26.5" style={{ stroke: "var(--ink-e)" }} strokeWidth="4.5" />
      <circle cx="16" cy="16" r="6.25" style={{ fill: "var(--enamel-950)", stroke: "var(--porcelain-50)" }} strokeWidth="3.5" />
    </svg>
  );
}
