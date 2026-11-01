import { useId, useState } from 'react';
import { inr, firstName } from '../utils';
import { Segmented } from './ui';

const W = 420;
const H = 300;
const R = 24; // node radius

function layout(members) {
  const cx = W / 2;
  const cy = H / 2;
  const rx = members.length <= 2 ? 120 : 150;
  const ry = 98;
  const pos = {};
  members.forEach((m, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / members.length;
    pos[m.id] = { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  });
  return pos;
}

/**
 * Who pays whom. "Simplified" is the minimum set of payments that settles the whole group;
 * "Original" nets each pair of people but does not route money through anyone else.
 */
export default function DebtGraph({ members, transfers, rawTransfers, meId }) {
  const [mode, setMode] = useState('simplified');
  const markerId = useId().replace(/:/g, '');
  const list = mode === 'simplified' ? transfers : rawTransfers;
  const byId = Object.fromEntries(members.map((m) => [m.id, m]));
  const pos = layout(members);
  const saved = rawTransfers.length - transfers.length;

  return (
    <div>
      <Segmented
        label="Payment view"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'simplified', label: `Simplified (${transfers.length})` },
          { value: 'original', label: `Original (${rawTransfers.length})` },
        ]}
      />

      <p className="mt-3 min-h-5 text-sm text-muted">
        {saved > 0
          ? mode === 'simplified'
            ? `Simplifying saves ${saved} ${saved === 1 ? 'payment' : 'payments'}.`
            : `These are the original debts. Switch to Simplified to cut ${saved} ${saved === 1 ? 'payment' : 'payments'}.`
          : transfers.length === 0
            ? ''
            : 'These are already the fewest payments possible.'}
      </p>

      {list.length === 0 ? (
        <div className="grid h-48 place-items-center text-center">
          <div>
            <p className="text-3xl" aria-hidden="true">🎉</p>
            <p className="mt-2 font-display text-lg font-semibold">Everyone is settled up</p>
            <p className="text-sm text-muted">No payments to make in this group.</p>
          </div>
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-1 w-full"
          role="img"
          aria-label={`Payment graph. ${list
            .map((t) => `${byId[t.from]?.name} pays ${byId[t.to]?.name} ${inr(t.amount)}`)
            .join('. ')}`}
        >
          <defs>
            <marker id={markerId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10z" fill="var(--brand)" />
            </marker>
          </defs>

          {list.map((t) => {
            const a = pos[t.from];
            const b = pos[t.to];
            if (!a || !b) return null;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const len = Math.hypot(dx, dy) || 1;
            const ux = dx / len;
            const uy = dy / len;
            const x1 = a.x + ux * (R + 3);
            const y1 = a.y + uy * (R + 3);
            const x2 = b.x - ux * (R + 6);
            const y2 = b.y - uy * (R + 6);
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            const label = inr(t.amount);
            const labelW = label.length * 7.4 + 14;
            const mine = t.from === meId || t.to === meId;
            return (
              <g key={`${t.from}-${t.to}`} opacity={mine || !meId ? 1 : 0.55}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="var(--brand)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  markerEnd={`url(#${markerId})`}
                  className="flow"
                />
                <rect x={mx - labelW / 2} y={my - 11} width={labelW} height="22" rx="11" fill="var(--surface)" stroke="var(--line)" />
                <text x={mx} y={my + 4.5} textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--ink)">
                  {label}
                </text>
              </g>
            );
          })}

          {members.map((m) => {
            const p = pos[m.id];
            const initials = m.name.split(/\s+/).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
            return (
              <g key={m.id}>
                <circle cx={p.x} cy={p.y} r={R} fill={m.color} stroke={m.id === meId ? 'var(--accent)' : 'var(--surface)'} strokeWidth="3" />
                <text x={p.x} y={p.y + 5} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">
                  {initials}
                </text>
                <text x={p.x} y={p.y + R + 15} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--ink)">
                  {m.id === meId ? 'You' : firstName(m.name)}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
