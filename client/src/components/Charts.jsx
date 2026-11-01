import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { categoryOf, inr, shortMonth } from '../utils';

const tooltipStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 12,
  color: 'var(--ink)',
  fontSize: 13,
  boxShadow: '0 8px 24px rgba(0,0,0,.12)',
};

/** Spending by category as a donut, with the legend as a readable list beside it. */
export function CategoryDonut({ data, emptyText = 'No spending yet.' }) {
  const rows = data.map((d) => ({ ...categoryOf(d.category), amount: d.amount }));
  const total = rows.reduce((s, r) => s + r.amount, 0);

  if (!total) return <p className="py-10 text-center text-sm text-muted">{emptyText}</p>;

  return (
    <div className="grid items-center gap-4 sm:grid-cols-[180px_1fr]">
      <div className="relative mx-auto h-[180px] w-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="amount"
              nameKey="label"
              innerRadius={58}
              outerRadius={86}
              paddingAngle={2}
              stroke="var(--surface)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {rows.map((r) => (
                <Cell key={r.key} fill={r.color} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => inr(v)} contentStyle={tooltipStyle} itemStyle={{ color: 'var(--ink)' }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="font-display text-lg font-bold leading-tight">{inr(total)}</p>
            <p className="text-xs text-muted">total</p>
          </div>
        </div>
      </div>

      <ul className="grid gap-1.5 text-sm">
        {rows.slice(0, 6).map((r) => (
          <li key={r.key} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">
              {r.emoji} {r.label}
            </span>
            <span className="text-muted">{Math.round((r.amount / total) * 100)}%</span>
            <span className="w-24 text-right font-semibold">{inr(r.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Your share of spending per month over the last six months. */
export function MonthlyTrend({ data }) {
  const rows = data.map((d) => ({ ...d, label: shortMonth(d.month), rupees: d.amount / 100 }));
  if (!rows.some((r) => r.amount > 0)) {
    return <p className="py-10 text-center text-sm text-muted">Add an expense to see your monthly trend.</p>;
  }

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
          <YAxis
            width={52}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--muted)', fontSize: 12 }}
            tickFormatter={(v) => (v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`)}
          />
          <Tooltip
            formatter={(v) => [inr(Math.round(v * 100)), 'Your share']}
            contentStyle={tooltipStyle}
            itemStyle={{ color: 'var(--ink)' }}
            cursor={{ stroke: 'var(--line)' }}
          />
          <Area
            type="monotone"
            dataKey="rupees"
            stroke="var(--brand)"
            strokeWidth={2.5}
            fill="url(#trendFill)"
            dot={{ r: 3, fill: 'var(--brand)', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
