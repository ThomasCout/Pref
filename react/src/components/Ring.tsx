export function Ring({ pct, size, stroke, track, color }: { pct: number; size: number; stroke: number; track: string; color: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(1, pct))), h = size / 2;
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={h} cy={h} r={+r.toFixed(1)} fill="none" stroke={track} strokeWidth={stroke} />
      <circle cx={h} cy={h} r={+r.toFixed(1)} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c.toFixed(1)} strokeDashoffset={off.toFixed(1)} />
    </svg>
  );
}
