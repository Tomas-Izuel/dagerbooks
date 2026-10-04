interface ArrowIconProps {
  direction?: "right" | "left" | "up-right";
}

/** Flecha dibujada (trazo 2, cuadrada), para botones de señalética. */
export function ArrowIcon({ direction = "right" }: ArrowIconProps) {
  const d = direction === "up-right" ? "M5 15 15 5M7 5h8v8" : "M3 10h13M11 5l5 5-5 5";
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={direction === "left" ? { transform: "scaleX(-1)" } : undefined}>
      <path d={d} stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  );
}
