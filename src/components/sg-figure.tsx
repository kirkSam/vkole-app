function partsOf(line: string): number[] | null {
  const matched = /^\[bar((?:\s+\d+)+)\s*\]$/.exec(line.trim());
  if (!matched) return null;
  const parts = matched[1]!.trim().split(/\s+/).map(Number).filter((part) => part > 0);
  return parts.length > 0 ? parts : null;
}

function bondOf(line: string): { whole: number; part: number } | null {
  const matched = /^\[bond\s+(\d+)\s+(\d+)\s*\]$/.exec(line.trim());
  if (!matched) return null;
  return { whole: Number(matched[1]), part: Number(matched[2]) };
}

export function SgFigure({ line }: { line: string }) {
  const parts = partsOf(line);
  if (parts) {
    const total = parts.reduce((sum, part) => sum + part, 0) || 1;
    let x = 0;
    return (
      <svg viewBox="0 0 240 56" role="img" aria-label={`Bar model with parts ${parts.join(" and ")}`} className="mt-3 h-14 w-full max-w-sm">
        {parts.map((part, index) => {
          const width = (part / total) * 236;
          const rect = (
            <g key={`${part}-${index}`}>
              <rect x={2 + x} y="8" width={Math.max(width, 1)} height="28" fill={index % 2 === 0 ? "#2c5e4a" : "#c6a15a"} />
              <text x={2 + x + width / 2} y="50" textAnchor="middle" fontSize="12" fill="#1d2420">
                {part}
              </text>
            </g>
          );
          x += width;
          return rect;
        })}
      </svg>
    );
  }
  const bond = bondOf(line);
  if (!bond) return null;
  const other = Math.max(0, bond.whole - bond.part);
  return (
    <svg viewBox="0 0 240 88" role="img" aria-label={`Number bond. Whole ${bond.whole}, parts ${bond.part} and ${other}`} className="mt-3 h-24 w-full max-w-sm">
      <circle cx="120" cy="18" r="16" fill="#2c5e4a" />
      <text x="120" y="23" textAnchor="middle" fontSize="12" fill="#f6f1e7">
        {bond.whole}
      </text>
      <line x1="108" y1="32" x2="64" y2="52" stroke="#1d2420" />
      <line x1="132" y1="32" x2="176" y2="52" stroke="#1d2420" />
      <circle cx="64" cy="68" r="16" fill="#c6a15a" />
      <circle cx="176" cy="68" r="16" fill="#e7efe9" stroke="#2c5e4a" />
      <text x="64" y="73" textAnchor="middle" fontSize="12" fill="#1c1408">
        {bond.part}
      </text>
      <text x="176" y="73" textAnchor="middle" fontSize="12" fill="#1d2420">
        {other}
      </text>
    </svg>
  );
}

export function splitFigures(prompt: string): { figures: string[]; text: string } {
  const figures: string[] = [];
  const lines: string[] = [];
  for (const line of prompt.split("\n")) {
    const trimmed = line.trim();
    if (/^\[(?:bar|bond)\b/.test(trimmed) && (partsOf(trimmed) || bondOf(trimmed))) figures.push(trimmed);
    else lines.push(line);
  }
  return { figures, text: lines.join("\n").trim() };
}
