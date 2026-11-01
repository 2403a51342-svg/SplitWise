import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, fileUrl } from '../api';
import { useAuth } from '../context/auth';
import { useLive } from '../context/live';
import { useToast } from '../context/toast';
import DebtGraph from '../components/DebtGraph';
import ExpenseModal from '../components/ExpenseModal';
import SettleModal from '../components/SettleModal';
import { CategoryDonut } from '../components/Charts';
import { Avatar, AvatarStack, ErrorNote, Field, Modal, Skeleton } from '../components/ui';
import { PlusIcon, ReceiptIcon, TrashIcon, UserPlusIcon } from '../components/icons';
import { categoryOf, dayLabel, firstName, inr, monthLabel } from '../utils';

function AddMemberModal({ groupId, onClose, onDone }) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { user } = await api(`/groups/${groupId}/members`, { method: 'POST', body: { email } });
      toast(`${user.name} joined the group`, 'success');
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Add a friend" onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4">
        <Field label="Their email" hint="They need a SplitMate account with this email.">
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" />
        </Field>
        <ErrorNote>{error}</ErrorNote>
        <button className="btn btn-accent" disabled={busy}>{busy ? 'Adding…' : 'Add to group'}</button>
      </form>
    </Modal>
  );
}

function ReceiptViewer({ url, onClose }) {
  return (
    <Modal title="Receipt" onClose={onClose} wide>
      <img src={fileUrl(url)} alt="Uploaded receipt" className="max-h-[70vh] w-full rounded-xl object-contain" />
    </Modal>
  );
}

export default function Group() {
  const { id } = useParams();
  const { user } = useAuth();
  const { version, lastEvent } = useLive();
  const toast = useToast();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // 'expense' | 'member' | { settle } | { receipt }
  const [flashId, setFlashId] = useState(null);
  const handledEvent = useRef(null);

  const load = useCallback(() => {
    api(`/groups/${id}`)
      .then((d) => {
        setData(d);
        setError('');
      })
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    setData(null);
  }, [id]);
  useEffect(load, [load, version]);

  // When a friend adds an expense, highlight the new row for a moment.
  useEffect(() => {
    if (!lastEvent || handledEvent.current === lastEvent.at) return;
    handledEvent.current = lastEvent.at;
    if (lastEvent.kind === 'expense' && String(lastEvent.groupId) === id) {
      setFlashId(lastEvent.expenseId);
      const t = setTimeout(() => setFlashId(null), 2600);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [lastEvent, id]);

  const byId = useMemo(() => Object.fromEntries((data?.members || []).map((m) => [m.id, m])), [data]);

  // Group the expense list by month, newest first.
  const months = useMemo(() => {
    const out = [];
    for (const e of data?.expenses || []) {
      const key = e.date.slice(0, 7);
      const last = out[out.length - 1];
      if (last?.key === key) last.items.push(e);
      else out.push({ key, label: monthLabel(e.date), items: [e] });
    }
    return out;
  }, [data]);

  async function remove(expense) {
    if (!window.confirm(`Delete “${expense.description}”? Everyone's balances will update.`)) return;
    try {
      await api(`/expenses/${expense.id}`, { method: 'DELETE' });
      toast('Expense deleted', 'success');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  if (error && !data) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <ErrorNote>{error}</ErrorNote>
        <Link to="/" className="btn btn-ghost mt-4">Back to dashboard</Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="grid gap-5" aria-busy="true" aria-label="Loading group">
        <Skeleton className="h-24" />
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  const { group, members, expenses, balances, transfers, rawTransfers, stats } = data;
  const myNet = balances[user.id] || 0;
  const myTransfers = transfers.filter((t) => t.from === user.id || t.to === user.id);
  const closeModal = () => setModal(null);
  const refresh = () => {
    closeModal();
    load();
  };

  return (
    <div className="grid gap-6">
      <div>
        <Link to="/" className="text-sm font-medium text-muted hover:text-ink">← All groups</Link>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <span className="grid h-16 w-16 place-items-center rounded-3xl bg-surface-2 text-4xl" aria-hidden="true">{group.emoji}</span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-3xl font-bold tracking-tight">{group.name}</h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted">
              <AvatarStack users={members} size={24} max={5} />
              {members.length} people · {inr(stats.total)} spent in total
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={() => setModal('member')}>
              <UserPlusIcon width={18} height={18} /> Add friend
            </button>
            <button className="btn btn-accent" onClick={() => setModal('expense')}>
              <PlusIcon width={18} height={18} /> Add expense
            </button>
          </div>
        </div>
      </div>

      <section
        className={`rounded-3xl p-5 sm:p-6 ${myNet === 0 ? 'bg-surface-2' : myNet > 0 ? 'bg-pos/10' : 'bg-neg/10'}`}
        aria-label="Your balance in this group"
      >
        {myNet === 0 ? (
          <p className="font-display text-xl font-semibold">You are settled up in this group 🎉</p>
        ) : (
          <p className="font-display text-xl font-semibold">
            {myNet > 0 ? 'You are owed ' : 'You owe '}
            <span className={myNet > 0 ? 'text-pos' : 'text-neg'}>{inr(Math.abs(myNet))}</span> in this group
          </p>
        )}
        {myTransfers.length > 0 && (
          <ul className="mt-4 grid gap-2">
            {myTransfers.map((t) => {
              const iPay = t.from === user.id;
              const other = byId[iPay ? t.to : t.from];
              return (
                <li key={`${t.from}-${t.to}`} className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface px-4 py-3">
                  <Avatar user={other} size={36} />
                  <span className="min-w-0 flex-1 text-sm">
                    {iPay ? (
                      <>You pay <strong>{firstName(other.name)}</strong></>
                    ) : (
                      <><strong>{firstName(other.name)}</strong> pays you</>
                    )}
                  </span>
                  <span className={`font-display text-lg font-bold ${iPay ? 'text-neg' : 'text-pos'}`}>{inr(t.amount)}</span>
                  <button className={`btn ${iPay ? 'btn-accent' : 'btn-ghost'} !py-2`} onClick={() => setModal({ settle: t })}>
                    {iPay ? 'Settle up' : 'Record payment'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel" aria-labelledby="graph-h">
          <h2 id="graph-h" className="mb-1 font-display text-xl font-semibold">Who pays whom</h2>
          <p className="mb-4 text-sm text-muted">The fewest payments that settle the whole group.</p>
          <DebtGraph members={members} transfers={transfers} rawTransfers={rawTransfers} meId={user.id} />
        </section>

        <section className="panel" aria-labelledby="bal-h">
          <h2 id="bal-h" className="mb-4 font-display text-xl font-semibold">Balances</h2>
          <ul className="grid gap-1">
            {[...members]
              .sort((a, b) => (balances[b.id] || 0) - (balances[a.id] || 0))
              .map((m) => {
                const v = balances[m.id] || 0;
                return (
                  <li key={m.id} className="flex items-center gap-3 rounded-xl px-1 py-2">
                    <Avatar user={m} size={36} />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {m.id === user.id ? 'You' : m.name}
                    </span>
                    <span className={`text-sm font-semibold ${v > 0 ? 'text-pos' : v < 0 ? 'text-neg' : 'text-muted'}`}>
                      {v === 0 ? 'settled up' : v > 0 ? `gets back ${inr(v)}` : `owes ${inr(-v)}`}
                    </span>
                  </li>
                );
              })}
          </ul>

          <h3 className="mb-3 mt-6 font-display text-base font-semibold">Spending by category</h3>
          <CategoryDonut data={stats.byCategory} emptyText="No expenses yet." />
        </section>
      </div>

      <section className="panel" aria-labelledby="exp-h">
        <h2 id="exp-h" className="mb-2 font-display text-xl font-semibold">Expenses</h2>
        {expenses.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-3xl" aria-hidden="true">🧾</p>
            <p className="mt-2 font-display text-lg font-semibold">No expenses yet</p>
            <p className="mt-1 text-sm text-muted">Add the first one and everyone in the group sees it instantly.</p>
            <button className="btn btn-accent mt-4" onClick={() => setModal('expense')}>Add expense</button>
          </div>
        ) : (
          months.map((m) => (
            <div key={m.key}>
              <h3 className="mt-4 text-sm font-semibold text-muted">{m.label}</h3>
              <ul className="divide-y divide-line">
                {m.items.map((e) => {
                  const cat = categoryOf(e.category);
                  const payer = byId[e.paidBy];
                  const myShare = e.splits.find((s) => s.userId === user.id)?.amount || 0;
                  const lent = e.paidBy === user.id ? e.amount - myShare : 0;
                  return (
                    <li key={e.id} className={`flex items-center gap-3 rounded-xl py-3 ${flashId === e.id ? 'row-flash' : ''}`}>
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface-2 text-xl" aria-hidden="true">{cat.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{e.description}</p>
                        <p className="truncate text-xs text-muted">
                          {e.paidBy === user.id ? 'You' : firstName(payer?.name)} paid {inr(e.amount)} · {dayLabel(e.date)}
                          {e.splitType !== 'equal' && ` · ${e.splitType === 'percent' ? 'by percent' : 'exact amounts'}`}
                        </p>
                      </div>
                      <div className="text-right text-xs text-muted">
                        {e.paidBy === user.id ? (
                          lent > 0 ? (
                            <>you lent<span className="block text-sm font-semibold text-pos">{inr(lent)}</span></>
                          ) : null
                        ) : myShare > 0 ? (
                          <>you owe<span className="block text-sm font-semibold text-neg">{inr(myShare)}</span></>
                        ) : (
                          <>not involved</>
                        )}
                      </div>
                      {e.receiptUrl && (
                        <button className="btn btn-quiet !px-2" onClick={() => setModal({ receipt: e.receiptUrl })} aria-label={`View receipt for ${e.description}`}>
                          <ReceiptIcon />
                        </button>
                      )}
                      {(e.createdBy === user.id || e.paidBy === user.id) && (
                        <button className="btn btn-quiet btn-danger !px-2" onClick={() => remove(e)} aria-label={`Delete ${e.description}`}>
                          <TrashIcon />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </section>

      {data.settlements.length > 0 && (
        <section className="panel" aria-labelledby="set-h">
          <h2 id="set-h" className="mb-2 font-display text-xl font-semibold">Payments made</h2>
          <ul className="divide-y divide-line">
            {data.settlements.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-3 text-sm">
                <span aria-hidden="true">✅</span>
                <span className="min-w-0 flex-1">
                  <strong>{s.fromUser === user.id ? 'You' : firstName(byId[s.fromUser]?.name)}</strong> paid{' '}
                  <strong>{s.toUser === user.id ? 'you' : firstName(byId[s.toUser]?.name)}</strong>
                </span>
                <span className="text-xs text-muted">{dayLabel(s.createdAt)}</span>
                <span className="font-semibold">{inr(s.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {modal === 'expense' && (
        <ExpenseModal groupId={group.id} members={members} meId={user.id} onClose={closeModal} onDone={refresh} />
      )}
      {modal === 'member' && <AddMemberModal groupId={group.id} onClose={closeModal} onDone={refresh} />}
      {modal?.settle && (
        <SettleModal
          groupId={group.id}
          groupName={group.name}
          transfer={modal.settle}
          members={members}
          meId={user.id}
          onClose={closeModal}
          onDone={refresh}
        />
      )}
      {modal?.receipt && <ReceiptViewer url={modal.receipt} onClose={closeModal} />}
    </div>
  );
}
