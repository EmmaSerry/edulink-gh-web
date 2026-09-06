/**
 * The hero's animated illustration - a central "cloud" hub with lines
 * drawing out to school nodes around it, each gently pulsing. Pure
 * inline SVG + CSS (see .ph-network-* rules in public-home.css) rather
 * than an image asset - it's small, it scales crisply at any size, and
 * it directly illustrates the actual product story (one cloud, many
 * schools across the country) instead of being decoration for its own
 * sake.
 */
const SCHOOLS = [
  { x: 60, y: 60 },
  { x: 340, y: 50 },
  { x: 370, y: 200 },
  { x: 220, y: 270 },
  { x: 40, y: 220 },
];

export function NetworkHeroGraphic() {
  return (
    <svg viewBox="0 0 400 300" className="ph-network" role="img" aria-label="A cloud connected to schools across the country">
      {SCHOOLS.map((s, i) => (
        <line
          key={i}
          x1={200}
          y1={150}
          x2={s.x}
          y2={s.y}
          pathLength={1}
          className="ph-network-line"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}

      {SCHOOLS.map((s, i) => (
        <g key={i} className="ph-network-node" style={{ animationDelay: `${0.9 + i * 0.15}s` }}>
          <circle cx={s.x} cy={s.y} r={20} className="ph-network-node-bg" />
          <path
            d={`M ${s.x - 9} ${s.y + 7} v -9 l 9 -7 l 9 7 v 9 z`}
            fill="none"
            stroke="#ffffff"
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
        </g>
      ))}

      <g className="ph-network-hub">
        <circle cx={200} cy={150} r={36} className="ph-network-hub-bg" />
        <path
          d="M182 158 a12 12 0 0 1 2 -23.7 a15 15 0 0 1 28.8 -4.3 a11 11 0 0 1 3.2 21.9 a1 1 0 0 1 -0.4 0.1 h-31 a1 1 0 0 1 -2.6 -0"
          transform="translate(0 6)"
          fill="none"
          stroke="#ffffff"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
