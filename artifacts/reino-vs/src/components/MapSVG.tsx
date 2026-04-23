import { useEffect, useRef, useState } from "react";
import type { MapLocation } from "../api";

interface Props {
  locations: MapLocation[];
  selectedId?: string | null;
  onSelect?: (loc: MapLocation) => void;
  highlightOwnerId?: string | null;
  height?: number | string;
  /** When true the user can pick a location by clicking. */
  picker?: boolean;
}

const VBW = 1000;
const VBH = 700;

function colorFor(loc: MapLocation, highlightOwnerId?: string | null) {
  if (highlightOwnerId && loc.ownerId === highlightOwnerId) return "#c0902a";
  if (loc.type === "capital") return "#c0902a";
  if (loc.type === "ciudad") return loc.ownerId ? "#7a3690" : "#5a3a18";
  return loc.ownerId ? "#9a5b22" : "#3a2a12";
}

export function MapSVG({ locations, selectedId, onSelect, highlightOwnerId, height = 520, picker = false }: Props) {
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: VBW, h: VBH });
  const [drag, setDrag] = useState<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.12 : 0.89;
    const newW = Math.max(200, Math.min(VBW * 1.5, viewBox.w * factor));
    const newH = newW * (VBH / VBW);
    // zoom around mouse
    const rect = svgRef.current!.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;
    const cx = viewBox.x + viewBox.w * mx;
    const cy = viewBox.y + viewBox.h * my;
    setViewBox({ x: cx - newW * mx, y: cy - newH * my, w: newW, h: newH });
  }

  function onMouseDown(e: React.MouseEvent) {
    setDrag({ sx: e.clientX, sy: e.clientY, ox: viewBox.x, oy: viewBox.y });
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!drag) return;
    const rect = svgRef.current!.getBoundingClientRect();
    const dx = ((e.clientX - drag.sx) / rect.width) * viewBox.w;
    const dy = ((e.clientY - drag.sy) / rect.height) * viewBox.h;
    setViewBox({ ...viewBox, x: drag.ox - dx, y: drag.oy - dy });
  }
  function onMouseUp() { setDrag(null); }

  useEffect(() => {
    function up() { setDrag(null); }
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  function reset() { setViewBox({ x: 0, y: 0, w: VBW, h: VBH }); }

  return (
    <div className="relative w-full" style={{ height }}>
      {/* Controls */}
      <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
        <button onClick={() => setViewBox(v => ({ ...v, w: v.w * 0.85, h: v.h * 0.85, x: v.x + v.w * 0.075, y: v.y + v.h * 0.075 }))} className="stone-btn px-2 py-1" title="Acercar">+</button>
        <button onClick={() => setViewBox(v => ({ ...v, w: Math.min(VBW * 1.5, v.w * 1.18), h: Math.min(VBH * 1.5, v.h * 1.18), x: v.x - v.w * 0.09, y: v.y - v.h * 0.09 }))} className="stone-btn px-2 py-1" title="Alejar">−</button>
        <button onClick={reset} className="stone-btn px-2 py-1 text-xs" title="Restablecer">⟳</button>
      </div>
      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        className="w-full h-full select-none"
        style={{ background: "#e8d8a8", cursor: drag ? "grabbing" : "grab", borderRadius: 6, border: "4px double #6b4a1f" }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
      >
        <defs>
          <pattern id="parchment" patternUnits="userSpaceOnUse" width="160" height="160">
            <rect width="160" height="160" fill="#e8d8a8" />
            <circle cx="20" cy="40" r="1" fill="#a98c5e" opacity="0.4" />
            <circle cx="100" cy="80" r="1.5" fill="#8b6e3a" opacity="0.3" />
            <circle cx="60" cy="120" r="1" fill="#a98c5e" opacity="0.4" />
            <circle cx="140" cy="20" r="1" fill="#8b6e3a" opacity="0.3" />
          </pattern>
          <radialGradient id="seafade" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#8aaecf" />
            <stop offset="100%" stopColor="#5d87b0" />
          </radialGradient>
          <filter id="shadow"><feGaussianBlur stdDeviation="1.5" /></filter>
        </defs>

        {/* background */}
        <rect x="0" y="0" width={VBW} height={VBH} fill="url(#parchment)" />

        {/* sea around edges */}
        <path d="M 0,0 L 1000,0 L 1000,80 Q 500,40 0,90 Z" fill="url(#seafade)" opacity="0.55" />
        <path d="M 0,700 L 1000,700 L 1000,640 Q 600,680 0,620 Z" fill="url(#seafade)" opacity="0.55" />
        <path d="M 0,0 L 0,700 L 60,700 Q 30,350 60,0 Z" fill="url(#seafade)" opacity="0.5" />
        <path d="M 1000,0 L 1000,700 L 950,700 Q 970,350 950,0 Z" fill="url(#seafade)" opacity="0.5" />

        {/* mountains */}
        {[
          [200, 180], [320, 110], [820, 180], [880, 90], [180, 540], [820, 580], [560, 600],
        ].map(([cx, cy], i) => (
          <g key={i}>
            <polygon points={`${cx-30},${cy+25} ${cx},${cy-35} ${cx+30},${cy+25}`} fill="#8b6f3a" stroke="#5a4419" strokeWidth="1.5" />
            <polygon points={`${cx-15},${cy-5} ${cx},${cy-35} ${cx+15},${cy-5}`} fill="#fdfcf7" />
          </g>
        ))}

        {/* forests */}
        {[[450, 150], [120, 200], [710, 380], [430, 480], [880, 320], [260, 410]].map(([cx, cy], i) => (
          <g key={`f${i}`}>
            {[0,1,2,3,4].map(j => (
              <circle key={j} cx={cx + Math.cos(j * 1.3) * 18} cy={cy + Math.sin(j * 1.3) * 18} r="11" fill="#4a6b3a" opacity="0.9" />
            ))}
          </g>
        ))}

        {/* river */}
        <path d="M 50,100 Q 200,250 350,300 T 600,400 T 900,500" stroke="#6c93b3" strokeWidth="9" fill="none" opacity="0.65" />
        <path d="M 50,100 Q 200,250 350,300 T 600,400 T 900,500" stroke="#a3c4dc" strokeWidth="3" fill="none" opacity="0.8" />

        {/* roads */}
        {locations.filter(l => l.type !== "capital").map((l) => {
          const cap = locations.find(x => x.type === "capital");
          if (!cap) return null;
          return <line key={`r${l.id}`} x1={cap.x} y1={cap.y} x2={l.x} y2={l.y} stroke="#7a5a2c" strokeWidth="1.4" strokeDasharray="3,3" opacity="0.45" />;
        })}

        {/* compass rose */}
        <g transform="translate(900, 90)">
          <circle r="28" fill="#fdfcf7" stroke="#6b4a1f" strokeWidth="1.5" opacity="0.85" />
          <polygon points="0,-22 4,0 0,22 -4,0" fill="#6b4a1f" />
          <polygon points="-22,0 0,4 22,0 0,-4" fill="#6b4a1f" opacity="0.6" />
          <text y="-32" textAnchor="middle" fontSize="11" fill="#6b4a1f" fontWeight="bold">N</text>
        </g>

        {/* locations */}
        {locations.map((loc) => {
          const c = colorFor(loc, highlightOwnerId);
          const r = loc.type === "capital" ? 22 : loc.type === "ciudad" ? 16 : 10;
          const isSel = selectedId === loc.id;
          return (
            <g
              key={loc.id}
              transform={`translate(${loc.x}, ${loc.y})`}
              style={{ cursor: onSelect || picker ? "pointer" : "default" }}
              onClick={(e) => { e.stopPropagation(); onSelect?.(loc); }}
            >
              {isSel && <circle r={r + 8} fill="none" stroke="#c0902a" strokeWidth="3" />}
              {loc.type === "capital" ? (
                <g>
                  <rect x={-r} y={-r} width={r*2} height={r*2} fill={c} stroke="#3a1a05" strokeWidth="2" />
                  <polygon points={`${-r},${-r} ${-r+5},${-r-8} ${-r+10},${-r} `} fill="#c0902a" />
                  <polygon points={`${-r+5},${-r} ${0},${-r-12} ${r-5},${-r}`} fill="#c0902a" />
                  <polygon points={`${r-10},${-r} ${r-5},${-r-8} ${r},${-r}`} fill="#c0902a" />
                  <text y="4" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="bold">👑</text>
                </g>
              ) : loc.type === "ciudad" ? (
                <g>
                  <rect x={-r} y={-r/1.4} width={r*2} height={r*1.6} fill={c} stroke="#2a1808" strokeWidth="1.5" />
                  <polygon points={`${-r},${-r/1.4} ${0},${-r-3} ${r},${-r/1.4}`} fill={c} stroke="#2a1808" strokeWidth="1.5" />
                  <text y="4" textAnchor="middle" fill="#fff" fontSize="11">🏰</text>
                </g>
              ) : (
                <g>
                  <circle r={r} fill={c} stroke="#2a1808" strokeWidth="1.5" />
                  <text y="3" textAnchor="middle" fill="#fdf6e3" fontSize="9">🏘</text>
                </g>
              )}
              <text
                y={r + 13}
                textAnchor="middle"
                fontSize={loc.type === "capital" ? 14 : loc.type === "ciudad" ? 12 : 10}
                fontWeight="bold"
                fill="#2a1808"
                style={{ paintOrder: "stroke", stroke: "#fdf6e3", strokeWidth: 3 }}
              >
                {loc.name}
              </text>
              {loc.owner && (
                <text y={r + 26} textAnchor="middle" fontSize="9" fill="#5a1313" style={{ paintOrder: "stroke", stroke: "#fdf6e3", strokeWidth: 2 }}>
                  ♛ {loc.owner.username}
                </text>
              )}
            </g>
          );
        })}

        {/* legend */}
        <g transform="translate(20, 600)">
          <rect width="240" height="84" fill="#fdfcf7" stroke="#6b4a1f" strokeWidth="1.5" opacity="0.92" rx="3" />
          <text x="10" y="18" fontSize="13" fontWeight="bold" fill="#6b4a1f">Reino VS · Mapa</text>
          <circle cx="20" cy="36" r="6" fill="#c0902a" stroke="#3a1a05" />
          <text x="32" y="40" fontSize="11" fill="#2a1808">Capital</text>
          <rect x="14" y="48" width="14" height="10" fill="#7a3690" stroke="#2a1808" />
          <text x="32" y="58" fontSize="11" fill="#2a1808">Ciudad (5)</text>
          <circle cx="20" cy="74" r="5" fill="#9a5b22" stroke="#2a1808" />
          <text x="32" y="78" fontSize="11" fill="#2a1808">Pueblo (21)</text>
        </g>
      </svg>
    </div>
  );
}
