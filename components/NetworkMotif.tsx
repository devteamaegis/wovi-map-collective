// Thin lines + dots node-network motif, used on the hero and empty states.
export function NetworkMotif({
  className = "",
  light = true,
}: {
  className?: string;
  light?: boolean;
}) {
  const line = light ? "rgba(174,196,220,0.35)" : "rgba(74,110,146,0.25)";
  const dot = light ? "rgba(200,216,234,0.9)" : "rgba(74,110,146,0.6)";
  const dotHi = light ? "#9fc0e0" : "#4a6e92";

  const nodes = [
    [40, 60],
    [130, 30],
    [120, 120],
    [220, 80],
    [300, 40],
    [310, 150],
    [400, 100],
    [470, 50],
    [480, 160],
    [560, 110],
    [250, 175],
    [180, 70],
  ];
  const links = [
    [0, 1],
    [1, 3],
    [0, 2],
    [2, 3],
    [3, 4],
    [3, 5],
    [4, 6],
    [5, 6],
    [6, 7],
    [6, 8],
    [7, 9],
    [8, 9],
    [2, 10],
    [10, 5],
    [1, 11],
    [11, 3],
  ];

  return (
    <svg
      className={className}
      viewBox="0 0 600 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {links.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a][0]}
          y1={nodes[a][1]}
          x2={nodes[b][0]}
          y2={nodes[b][1]}
          stroke={line}
          strokeWidth={1}
        />
      ))}
      {nodes.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={i % 4 === 0 ? 4 : 2.5}
          fill={i % 4 === 0 ? dotHi : dot}
        />
      ))}
    </svg>
  );
}
