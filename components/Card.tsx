import { Eyebrow } from "./Eyebrow";

export function Card({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return <Tag className={`card ${className}`}>{children}</Tag>;
}

export function CardHeader({
  eyebrow,
  title,
  action,
  light = false,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  action?: React.ReactNode;
  light?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div className="space-y-2">
        {eyebrow ? <Eyebrow light={light}>{eyebrow}</Eyebrow> : null}
        <h2
          className={`serif text-xl leading-tight ${
            light ? "text-white" : "text-ink"
          }`}
        >
          {title}
        </h2>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
