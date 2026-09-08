import { formatCurrency, formatDateShort } from "../../utils/format";

/**
 * Gráfico de barras simple en SVG puro — no se agrega una librería de
 * gráficos solo para 14 barras; mantiene el bundle del admin liviano.
 */
export function SalesChart({ data }: { data: { date: string; total: number; orders: number }[] }) {
  const width = 700;
  const height = 220;
  const paddingBottom = 28;
  const paddingTop = 12;
  const barGap = 6;
  const maxTotal = Math.max(...data.map((d) => d.total), 1);
  const barWidth = (width - barGap * (data.length - 1)) / data.length;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[560px]" role="img" aria-label="Ventas de los últimos 14 días">
        {data.map((d, i) => {
          const barHeight = (d.total / maxTotal) * (height - paddingTop - paddingBottom);
          const x = i * (barWidth + barGap);
          const y = height - paddingBottom - barHeight;
          return (
            <g key={d.date}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, d.total > 0 ? 2 : 0)}
                className={d.total > 0 ? "fill-velvet-burgundy" : "fill-velvet-black/10"}
              >
                <title>
                  {formatDateShort(d.date)}: {formatCurrency(d.total)} ({d.orders} pedido{d.orders === 1 ? "" : "s"})
                </title>
              </rect>
              <text x={x + barWidth / 2} y={height - 10} textAnchor="middle" className="fill-velvet-ash text-[9px]">
                {formatDateShort(d.date).slice(0, 5)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
