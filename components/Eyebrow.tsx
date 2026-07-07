export function Eyebrow({
  children,
  light = false,
  className = "",
  as: Tag = "span",
}: {
  children: React.ReactNode;
  light?: boolean;
  className?: string;
  /** Render as a real heading (e.g. "h2") when this labels a page section, so it
      appears in the heading outline; defaults to a non-semantic span. */
  as?: "span" | "h2" | "h3";
}) {
  return (
    <Tag className={`eyebrow ${light ? "eyebrow--light" : ""} ${className}`}>
      {children}
    </Tag>
  );
}
