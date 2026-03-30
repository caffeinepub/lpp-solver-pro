import type { DisplayMode } from "../App";

interface Props {
  mode: DisplayMode;
  onChange: (mode: DisplayMode) => void;
}

export default function FractionToggle({ mode, onChange }: Props) {
  return (
    <div
      className="inline-flex rounded-lg border border-border overflow-hidden"
      data-ocid="display.toggle"
    >
      <button
        type="button"
        onClick={() => onChange("fraction")}
        className={`px-3 py-1.5 text-xs font-medium transition-colors ${
          mode === "fraction"
            ? "bg-primary text-white"
            : "bg-white text-muted-foreground hover:bg-secondary"
        }`}
      >
        Fraction
      </button>
      <button
        type="button"
        onClick={() => onChange("decimal")}
        className={`px-3 py-1.5 text-xs font-medium transition-colors ${
          mode === "decimal"
            ? "bg-primary text-white"
            : "bg-white text-muted-foreground hover:bg-secondary"
        }`}
      >
        Decimal
      </button>
    </div>
  );
}
