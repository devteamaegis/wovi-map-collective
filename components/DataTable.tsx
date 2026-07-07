import Link from "next/link";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowHref,
  rowKey,
  rowLabel,
  empty,
}: {
  columns: Column<T>[];
  rows: T[];
  rowHref?: (row: T) => string;
  /** Stable identity per row — avoids index keys breaking under sort/filter. */
  rowKey?: (row: T) => string | number;
  /** Accessible name for the whole-row link when rowHref is set. */
  rowLabel?: (row: T) => string;
  empty?: React.ReactNode;
}) {
  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-rule bg-white">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-rule">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-ink-3 ${
                  c.headerClassName || ""
                }`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const href = rowHref?.(row);
            return (
              <tr
                key={rowKey ? rowKey(row) : i}
                className="relative border-b border-rule last:border-0 transition-colors hover:bg-[#f1f4f7]/60"
              >
                {columns.map((c, ci) => (
                  <td
                    key={c.key}
                    className={`px-4 py-3 align-middle text-ink-2 ${c.className || ""}`}
                  >
                    {/* One stretched link per row → a single tab stop + one SR
                        announcement, instead of one identical link per cell. */}
                    {href && ci === 0 ? (
                      <Link
                        href={href}
                        aria-label={rowLabel ? rowLabel(row) : "View details"}
                        className="absolute inset-0"
                      />
                    ) : null}
                    <span className="relative">{c.render(row)}</span>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
