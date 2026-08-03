/**
 * Sun Miles brand mark — SVG recreation of the official logo (sunburst over a
 * green hill and blue waves) in the brand colors. Self-contained + scalable.
 *
 * To use the exact raster artwork instead, drop the PNG at public/sun-miles-logo.png
 * and swap this for <img src="/sun-miles-logo.png" ... />.
 */
export function SunMilesMark({ className = "" }: { className?: string }) {
  const rays: number[] = [];
  for (let a = -132; a <= 132; a += 12) rays.push(a);
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="Sun Miles">
      {/* Sunburst */}
      <g transform="translate(50,45)">
        {rays.map((a) => (
          <line
            key={a}
            x1="0"
            y1="-19"
            x2="0"
            y2="-39"
            transform={`rotate(${a})`}
            stroke="#F6C500"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        ))}
      </g>
      {/* Green hill */}
      <path
        d="M13,60 C28,60 35,40 50,40 C65,40 72,60 87,60 C80,66 67,63 57,64.2 C49.5,65 42,66.3 32,65.2 C25,64.4 19,62.8 13,60 Z"
        fill="#1E7A3D"
      />
      {/* Blue waves */}
      <path d="M15,64.5 C30,58 40,70.5 52,64.5 C64,58.5 74,66.5 87,62" fill="none" stroke="#1557B0" strokeWidth="3.1" strokeLinecap="round" />
      <path d="M19,72 C33,66 43,77 55,70.5 C66,65 75,71.5 84,68.5" fill="none" stroke="#1557B0" strokeWidth="3.1" strokeLinecap="round" />
    </svg>
  );
}
