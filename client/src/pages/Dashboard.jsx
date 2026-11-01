import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/auth';
import { useLive } from '../context/live';
import BalanceBeam from '../components/BalanceBeam';
import { CategoryDonut, MonthlyTrend } from '../components/Charts';
import NewGroupModal from '../components/NewGroupModal';
import { Avatar, AvatarStack, ErrorNote, Skeleton } from '../components/ui';
import { PlusIcon } from '../components/icons';
import { categoryOf, dayLabel, firstName, inr } from '../utils';

function Balance({ value }) {
  if (value === 0) return <span className="text-sm font-medium text-muted">Settled up</span>;
  const owed = value > 0;
  return (
    <span className={`text-right text-sm font-semibold ${owed ? 'text-pos' : 'text-neg'}`}>
      <span className="block text-xs font-medium text-muted">{owed ? 'you are owed' : 'you owe'}</span>
      {inr(Math.abs(value))}
    </span>
  );
}

function ActivityRow({ item, meId }) {
  if (item.kind === 'settlement') {
    const mineOut = item.fromUser === meId;
    return (
      <li className="flex items-center gap-3 py-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-pos/10 text-lg" aria-hidden="true">✅</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {mineOut ? 'You' : firstName(item.fromName)} paid {item.toUser === meId ? 'you' : firstName(item.toName)}
          </p>
          <p className="truncate text-xs text-muted">
            {item.groupEmoji} {item.groupName} · {dayLabel(item.date)}
          </p>
        </div>
        <span className="text-sm font-semibold">{inr(item.amount)}</span>
      </li>
    );
  }
  const cat = categoryOf(item.category);
  return (
    <li className="flex items-center gap-3 py-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-lg" aria-hidden="true">
        {cat.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{item.description}</p>
        <p className="truncate text-xs text-muted">
          {item.paidBy === meId ? 'You' : firstName(item.paidByName)} paid {inr(item.amount)} · {item.groupEmoji}{' '}
          {item.groupName} · {dayLabel(item.date)}
        </p>
      </div>
      <span className="text-right text-xs text-muted">
        your share
        <span className="block text-sm font-semibold text-ink">{inr(item.myShare)}</span>
      </span>
    </li>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { version } = useLive();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [newGroup, setNewGroup] = useState(false);

  const load = useCallback(() => {
    api('/dashboard')
      .then((d) => {
        setData(d);
        setError('');
      })
      .catch((e) => setError(e.message));
  }, []);

  // Refetch on mount and whenever a friend changes something (real-time `version` bump).
  useEffect(load, [load, version]);

  if (error && !data) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <ErrorNote>{error}</ErrorNote>
        <button className="btn btn-ghost mt-4" onClick={load}>Try again</button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="grid gap-5" aria-busy="true" aria-label="Loading your dashboard">
        <Skeleton className="h-64" />
        <div className="grid gap-5 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const hasGroups = data.groups.length > 0;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Hi, {firstName(user.name)}</h1>
        <p className="mt-1 text-muted">Here is where everything stands.</p>
      </div>

      <BalanceBeam owe={data.totals.youOwe} owed={data.totals.youAreOwed} />

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <section className="panel" aria-labelledby="groups-h">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="groups-h" className="font-display text-xl font-semibold">Your groups</h2>
            <button className="btn btn-accent !py-2" onClick={() => setNewGroup(true)}>
              <PlusIcon width={18} height={18} /> New group
            </button>
          </div>

          {hasGroups ? (
            <ul className="grid gap-2">
              {data.groups.map((g) => (
                <li key={g.id}>
                  <Link
                    to={`/groups/${g.id}`}
                    className="flex items-center gap-4 rounded-2xl border border-line px-4 py-3.5 transition-colors hover:bg-surface-2"
                  >
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-surface-2 text-2xl" aria-hidden="true">
                      {g.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-lg font-semibold">{g.name}</span>
                      <span className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                        <AvatarStack users={g.members} size={22} />
                        {g.members.length} people · {inr(g.total)} spent
                      </span>
                    </span>
                    <Balance value={g.balance} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-line px-6 py-10 text-center">
              <p className="text-3xl" aria-hidden="true">👋</p>
              <p className="mt-2 font-display text-lg font-semibold">Start your first group</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
                Make a group for a trip, your flat or a night out, then add the first expense.
              </p>
              <button className="btn btn-accent mt-4" onClick={() => setNewGroup(true)}>Create a group</button>
            </div>
          )}
        </section>

        <section className="panel" aria-labelledby="people-h">
          <h2 id="people-h" className="mb-4 font-display text-xl font-semibold">Between you and friends</h2>
          {data.people.length ? (
            <ul className="grid gap-1">
              {data.people.map(({ user: p, amount }) => (
                <li key={p.id} className="flex items-center gap-3 rounded-xl px-1 py-2">
                  <Avatar user={p} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <p className="text-xs text-muted">{amount > 0 ? 'owes you' : 'you owe them'}</p>
                  </div>
                  <span className={`font-display text-lg font-bold ${amount > 0 ? 'text-pos' : 'text-neg'}`}>
                    {inr(Math.abs(amount))}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-muted">Nobody owes you, and you owe nobody.</p>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel" aria-labelledby="cat-h">
          <h2 id="cat-h" className="mb-1 font-display text-xl font-semibold">Where your money goes</h2>
          <p className="mb-4 text-sm text-muted">Your share of every expense, by category.</p>
          <CategoryDonut data={data.byCategory} emptyText="Add an expense to see your spending by category." />
        </section>

        <section className="panel" aria-labelledby="trend-h">
          <h2 id="trend-h" className="mb-1 font-display text-xl font-semibold">Monthly spending</h2>
          <p className="mb-4 text-sm text-muted">Your share over the last six months.</p>
          <MonthlyTrend data={data.monthly} />
        </section>
      </div>

      <section className="panel" aria-labelledby="act-h">
        <h2 id="act-h" className="mb-1 font-display text-xl font-semibold">Recent activity</h2>
        {data.activity.length ? (
          <ul className="divide-y divide-line">
            {data.activity.map((a) => (
              <ActivityRow key={`${a.kind}-${a.id}`} item={a} meId={user.id} />
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-sm text-muted">Expenses and payments will show up here.</p>
        )}
      </section>

      {newGroup && <NewGroupModal onClose={() => setNewGroup(false)} />}
    </div>
  );
}
