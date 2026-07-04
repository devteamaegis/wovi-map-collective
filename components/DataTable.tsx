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
  empty,
}: {
  columns: Column<T>[];
  rows: T[];
  rowHref?: (row: T) => string;
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
            const inner = columns.map((c) => (
              <td
                key={c.key}
                className={`px-4 py-3 align-middle text-ink-2 ${c.className || ""}`}
              >
                {c.render(row)}
              </td>
            ));
            return (
              <tr
                key={i}
                className="border-b border-rule last:border-0 transition-colors hover:bg-[#f1f4f7]/60"
              >
                {href
                  ? columns.map((c, ci) => (
                      <td
                        key={c.key}
                        className={`px-4 py-3 align-middle text-ink-2 ${
                          c.className || ""
                        }`}
                      >
                        <Link
                          href={href}
                          className="block -mx-4 -my-3 px-4 py-3 no-underline text-inherit"
                        >
                          {c.render(row)}
                        </Link>
                      </td>
                    ))
                  : inner}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
