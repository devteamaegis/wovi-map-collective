export function Eyebrow({
  children,
  light = false,
  className = "",
}: {
  children: React.ReactNode;
  light?: boolean;
  className?: string;
}) {
  return (
    <span className={`eyebrow ${light ? "eyebrow--light" : ""} ${className}`}>
      {children}
    </span>
  );
}
