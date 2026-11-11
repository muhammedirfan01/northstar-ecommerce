import { useState } from "react";
import { money } from "../operations/data.js";

const net = (point) => (point ? point.collected - (point.refunded || 0) : 0);
const shortDate = (period) =>
  new Date(
    period.length === 7 ? period + "-01T12:00:00Z" : period + "T12:00:00Z",
  ).toLocaleDateString("en-US", {
    month: "short",
    ...(period.length === 7 ? {} : { day: "numeric" }),
    timeZone: "UTC",
  });

// Monotone cubic curves stay between adjacent actual values, without inventing peaks.
function smoothPath(points) {
  if (!points.length) return "";
  const slopes = points
    .slice(1)
    .map((p, i) => (p[1] - points[i][1]) / (p[0] - points[i][0]));
  const tangent = points.map((_, i) => {
    if (!i) return slopes[0] || 0;
    if (i === points.length - 1) return slopes.at(-1) || 0;
    return slopes[i - 1] * slopes[i] <= 0
      ? 0
      : 2 / (1 / slopes[i - 1] + 1 / slopes[i]);
  });
  return points.reduce((path, point, i) => {
    if (!i) return `M${point[0]},${point[1]}`;
    const previous = points[i - 1],
      dx = (point[0] - previous[0]) / 3;
    return `${path} C${previous[0] + dx},${previous[1] + dx * tangent[i - 1]} ${point[0] - dx},${point[1] - dx * tangent[i]} ${point[0]},${point[1]}`;
  }, "");
}

export default function SalesChart({ current, previous, from, to, group }) {
  const [selected, setSelected] = useState(null);
  const periods = [];
  for (let at = Date.parse(from); at <= Date.parse(to); at += 86400000) {
    const period = new Date(at)
      .toISOString()
      .slice(0, group === "month" ? 7 : 10);
    if (periods.at(-1) !== period) periods.push(period);
  }
  const points = periods.map(
    (period) =>
      current.find((p) => p.period === period) || {
        period,
        collected: 0,
        refunded: 0,
        orders: 0,
      },
  );
  if (!points.length)
    return <p className="sr-empty">Select a valid reporting range.</p>;
  const high = Math.max(100, ...points.map(net), ...previous.map(net));
  const low = Math.min(0, ...points.map(net), ...previous.map(net));
  const rawStep = (high - low) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10]
    .map((n) => n * magnitude)
    .find((n) => n >= rawStep);
  const min = Math.floor(low / step) * step;
  const max = Math.ceil(high / step) * step;
  const ticks = Array.from(
    { length: Math.round((max - min) / step) + 1 },
    (_, i) => min + i * step,
  );
  const x = (i, length = points.length) =>
    length === 1 ? 470 : 60 + (i / (length - 1)) * 820;
  const y = (value) => 240 - ((value - min) / (max - min)) * 210;
  const coordinates = (rows) =>
    rows.map((p, i) => [x(i, rows.length), y(net(p))]);
  const peak = points.reduce(
    (best, p, i) => (net(p) > net(points[best]) ? i : best),
    0,
  );
  const index = selected == null ? peak : Math.min(selected, points.length - 1);
  const active = points[index];
  const oldIndex = Math.round(
    (index / Math.max(1, points.length - 1)) * Math.max(0, previous.length - 1),
  );
  const before = previous[oldIndex];
  const growth = net(before)
    ? ((net(active) - net(before)) / Math.abs(net(before))) * 100
    : null;
  const currentPath = smoothPath(coordinates(points));
  const tickMoney = (value) =>
    value === 0
      ? "₹0"
      : Math.abs(value) >= 10000000
        ? `₹${(value / 10000000).toFixed(1)}L`
        : Math.abs(value) >= 100000
          ? `₹${(value / 100000).toFixed(0)}K`
          : money(value);
  return (
    <div className="sr-chart">
      <svg
        viewBox="0 0 920 300"
        aria-label="Net sales over time, current and previous period"
        onPointerMove={(e) => {
          const bounds = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - bounds.left) / bounds.width) * 920;
          setSelected(
            Math.max(
              0,
              Math.min(
                points.length - 1,
                Math.round(((px - 60) / 820) * (points.length - 1)),
              ),
            ),
          );
        }}
        onPointerLeave={() => setSelected(null)}
      >
        <defs>
          <linearGradient id="sales-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#202020" stopOpacity=".09" />
            <stop offset="100%" stopColor="#202020" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((value) => (
          <g key={value}>
            <line
              x1="60"
              x2="880"
              y1={y(value)}
              y2={y(value)}
              stroke="#ebe8e4"
              strokeDasharray={value ? "3 4" : undefined}
            />
            <text
              x="48"
              y={y(value) + 4}
              textAnchor="end"
              fill="#98949c"
              fontSize="11"
            >
              {tickMoney(value)}
            </text>
          </g>
        ))}
        <path
          className="sr-chart-area"
          d={`${currentPath} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`}
          fill="url(#sales-fill)"
        />
        <path
          className="sr-chart-previous"
          d={smoothPath(coordinates(previous))}
          fill="none"
          stroke="#aaa39d"
          strokeWidth="2"
          strokeDasharray="4 4"
        />
        <path
          className="sr-chart-current"
          d={currentPath}
          fill="none"
          stroke="#202020"
          strokeWidth="2.5"
        />
        <line
          x1={x(index)}
          x2={x(index)}
          y1={y(net(active))}
          y2="240"
          stroke="#b5afa9"
          strokeDasharray="3 3"
        />
        {points.map((p, i) => (
          <g key={p.period}>
            {Math.abs(x(i) - x(index)) > 65 &&
              (i === 0 ||
                i === points.length - 1 ||
                (points.length > 5 &&
                  i % Math.ceil(points.length / 6) === 0)) && (
                <text
                  x={x(i)}
                  y="281"
                  textAnchor="middle"
                  fontSize="11"
                  fill="#817b75"
                >
                  {shortDate(p.period)}
                </text>
              )}
            <circle
              cx={x(i)}
              cy={y(net(p))}
              r="8"
              fill="transparent"
              tabIndex="0"
              role="button"
              aria-label={`${p.period}: ${money(net(p))}, ${p.orders} orders`}
              onFocus={() => setSelected(i)}
              onClick={() => setSelected(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(i);
                }
              }}
            />
          </g>
        ))}
        <circle cx={x(index)} cy={y(net(active))} r="3.5" fill="#202020" />
        <g>
          <rect
            x={Math.max(0, Math.min(820, x(index) - 50))}
            y="267"
            width="100"
            height="22"
            rx="4"
            fill="#f5f5f4"
          />
          <text
            x={Math.max(50, Math.min(870, x(index)))}
            y="282"
            textAnchor="middle"
            fontSize="10"
            fontWeight="600"
            fill="#282522"
          >
            {shortDate(active.period)}
            {index === peak ? " (Peak)" : ""}
          </text>
        </g>
      </svg>
      <div
        className="sr-chart-tooltip"
        style={{
          left: `${Math.max(17, Math.min(78, x(index) / 9.2))}%`,
          top: `${Math.max(12, Math.min(48, y(net(active)) / 3 - 9))}%`,
        }}
        aria-live="polite"
      >
        <div className="sr-tooltip-heading">
          <strong>
            {new Date(
              active.period.length === 7
                ? active.period + "-01T12:00:00Z"
                : active.period + "T12:00:00Z",
            ).toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
              timeZone: "UTC",
            })}
          </strong>
          {growth !== null && (
            <b
              className={
                growth < 0 ? "sr-tooltip-negative" : "sr-tooltip-positive"
              }
            >
              {growth >= 0 ? "+" : ""}
              {growth.toFixed(1)}%
            </b>
          )}
        </div>
        <span>
          <i className="sr-current-dot" />
          Current <b>{money(net(active))}</b>
        </span>
        <span>
          <i className="sr-previous-dot" />
          Previous <b>{money(net(before))}</b>
        </span>
        <span className="sr-tooltip-orders">
          Orders placed <b>{active.orders} orders</b>
        </span>
      </div>
      <p className="cm-sr-only" aria-live="polite">
        {active.period}: current {money(net(active))}, previous{" "}
        {money(net(before))}, {active.orders} orders.
      </p>
    </div>
  );
}
