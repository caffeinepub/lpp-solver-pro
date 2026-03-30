export function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y > 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

export function toFraction(n: number): string {
  if (Math.abs(n) < 1e-9) return "0";
  const MAX_DENOM = 1000;
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const whole = Math.floor(abs);
  const frac = abs - whole;

  if (frac < 1e-9) return `${sign}${whole}`;

  // Find best fraction with denominator <= MAX_DENOM
  let bestNum = 1;
  let bestDen = 1;
  let bestErr = Number.POSITIVE_INFINITY;
  for (let den = 1; den <= MAX_DENOM; den++) {
    const num = Math.round(frac * den);
    const err = Math.abs(frac - num / den);
    if (err < bestErr) {
      bestErr = err;
      bestNum = num;
      bestDen = den;
    }
    if (err < 1e-9) break;
  }

  if (bestErr > 1e-4) {
    // Fall back to decimal
    return n.toFixed(4).replace(/\.?0+$/, "");
  }

  const g = gcd(bestNum, bestDen);
  bestNum /= g;
  bestDen /= g;

  // If denominator is 1, return as integer
  if (bestDen === 1) {
    return `${sign}${whole + bestNum}`;
  }

  if (whole === 0) {
    return `${sign}${bestNum}/${bestDen}`;
  }
  // Represent as improper fraction
  const totalNum = whole * bestDen + bestNum;
  return `${sign}${totalNum}/${bestDen}`;
}

export function formatValue(n: number, mode: "fraction" | "decimal"): string {
  if (mode === "fraction") return toFraction(n);
  if (Math.abs(n) < 1e-9) return "0";
  const rounded = Math.round(n * 1e9) / 1e9;
  if (Number.isInteger(rounded)) return String(rounded);
  return n.toFixed(4).replace(/\.?0+$/, "");
}
