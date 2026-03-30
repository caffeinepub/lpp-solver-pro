import type { DisplayMode } from "../App";
import type { Tableau } from "../lppSolver";
import { formatValue } from "../utils/fractions";

interface Props {
  tableau: Tableau;
  pivotRow?: number;
  pivotCol?: number;
  showHighlights?: boolean;
  displayMode?: DisplayMode;
}

export default function TableauDisplay({
  tableau,
  pivotRow,
  pivotCol,
  showHighlights = false,
  displayMode = "decimal",
}: Props) {
  const { matrix, basis, varNames } = tableau;

  const cols = varNames.length;
  const rowHeaders = ["Z", ...basis.map((b) => varNames[b])];

  function fmt(n: number): string {
    return formatValue(n, displayMode);
  }

  return (
    <div className="table-scroll rounded-lg border border-border">
      <table className="min-w-max text-sm border-collapse">
        <thead>
          <tr className="bg-secondary">
            <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-r border-border">
              Basis
            </th>
            {varNames.map((name, j) => (
              <th
                key={name}
                className={`px-3 py-2 text-center font-semibold border-b border-border ${
                  j < cols - 1 ? "border-r" : ""
                } ${
                  showHighlights && pivotCol === j
                    ? "bg-blue-100"
                    : "text-muted-foreground"
                }`}
              >
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr
              key={rowHeaders[i]}
              className={i % 2 === 0 ? "bg-white" : "bg-background"}
            >
              <td className="px-3 py-2 font-semibold text-muted-foreground border-r border-border text-sm">
                {rowHeaders[i]}
              </td>
              {row.map((val, j) => {
                const isPC = showHighlights && pivotCol === j && j < cols - 1;
                const isPR = showHighlights && pivotRow === i;
                const isIntersect = isPC && isPR;
                const borderClass =
                  j < cols - 1 ? "border-r border-border" : "";
                const baseClass = `px-3 py-2 text-center ${borderClass}`;
                const cellKey = varNames[j];
                if (isIntersect) {
                  return (
                    <td
                      key={cellKey}
                      className={`${baseClass} font-bold`}
                      style={{ backgroundColor: "#FEF3C7" }}
                    >
                      {fmt(val)}
                    </td>
                  );
                }
                if (isPR) {
                  return (
                    <td
                      key={cellKey}
                      className={baseClass}
                      style={{ backgroundColor: "#D1FAE5" }}
                    >
                      {fmt(val)}
                    </td>
                  );
                }
                if (isPC) {
                  return (
                    <td
                      key={cellKey}
                      className={baseClass}
                      style={{ backgroundColor: "#DBEAFE" }}
                    >
                      {fmt(val)}
                    </td>
                  );
                }
                return (
                  <td key={cellKey} className={baseClass}>
                    {fmt(val)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
