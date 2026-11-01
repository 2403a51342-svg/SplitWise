import { useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { useToast } from '../context/toast';
import { Avatar, ErrorNote, Field, Modal, Segmented } from './ui';
import { CATEGORIES, evenSplit, firstName, inr, rupeesToPaise, todayLocal } from '../utils';
import { ImageIcon } from './icons';

const SPLITS = [
  { value: 'equal', label: 'Equally' },
  { value: 'exact', label: 'Exact ₹' },
  { value: 'percent', label: 'Percent' },
];

export default function ExpenseModal({ groupId, members, meId, onClose, onDone }) {
  const toast = useToast();
  const fileRef = useRef(null);

  const [description, setDescription] = useState('');
  const [amountText, setAmountText] = useState('');
  const [category, setCategory] = useState('food');
  const [paidBy, setPaidBy] = useState(meId);
  const [date, setDate] = useState(todayLocal());
  const [splitType, setSplitType] = useState('equal');
  const [included, setIncluded] = useState(() => new Set(members.map((m) => m.id)));
  const [values, setValues] = useState({}); // userId -> text typed in exact/percent mode
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const amount = rupeesToPaise(amountText);
  const people = members.filter((m) => included.has(m.id));

  const toggle = (id) =>
    setIncluded((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Live preview of each person's share, plus whether the typed numbers add up.
  const { shares, problem } = useMemo(() => {
    if (!people.length) return { shares: {}, problem: 'Pick at least one person to split with' };
    if (splitType === 'equal') {
      const parts = evenSplit(amount, people.length);
      return { shares: Object.fromEntries(people.map((p, i) => [p.id, parts[i]])), problem: '' };
    }
    if (splitType === 'exact') {
      const parts = Object.fromEntries(people.map((p) => [p.id, rupeesToPaise(values[p.id])]));
      const sum = Object.values(parts).reduce((a, b) => a + b, 0);
      const diff = amount - sum;
      return {
        shares: parts,
        problem:
          amount && diff !== 0
            ? diff > 0
              ? `${inr(diff)} left to assign`
              : `${inr(-diff)} over the total`
            : '',
      };
    }
    const pcts = Object.fromEntries(people.map((p) => [p.id, Number(values[p.id]) || 0]));
    const total = Object.values(pcts).reduce((a, b) => a + b, 0);
    return {
      shares: Object.fromEntries(people.map((p) => [p.id, Math.round((amount * pcts[p.id]) / 100)])),
      problem: Math.abs(total - 100) > 0.01 ? `Percentages add up to ${+total.toFixed(2)}, not 100` : '',
    };
  }, [people, splitType, amount, values]);

  function pickReceipt(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('That image is over 5 MB. Choose a smaller photo.');
      e.target.value = '';
      return;
    }
    setError('');
    setReceipt(file);
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!description.trim()) return setError('Give the expense a description');
    if (!amount) return setError('Enter an amount greater than zero');
    if (problem) return setError(problem);

    const participants = people.map((p) => ({
      userId: p.id,
      ...(splitType === 'exact' ? { value: rupeesToPaise(values[p.id]) } : {}),
      ...(splitType === 'percent' ? { value: Number(values[p.id]) || 0 } : {}),
    }));

    const form = new FormData();
    form.set('description', description.trim());
    form.set('amount', String(amount));
    form.set('category', category);
    form.set('paidBy', String(paidBy));
    form.set('date', date);
    form.set('splitType', splitType);
    form.set('participants', JSON.stringify(participants));
    if (receipt) form.set('receipt', receipt);

    setBusy(true);
    try {
      await api(`/groups/${groupId}/expenses`, { method: 'POST', form });
      toast(`Added “${description.trim()}”`, 'success');
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Add an expense" onClose={onClose} wide>
      <form onSubmit={submit} className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
          <Field label="What was it for?">
            <input
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Dinner at the beach shack"
              maxLength={80}
              required
            />
          </Field>
          <Field label="Amount (₹)">
            <input
              className="input"
              inputMode="decimal"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              placeholder="0"
              required
            />
          </Field>
        </div>

        <div className="grid gap-1.5 text-sm">
          <span className="font-medium">Category</span>
          <div className="flex flex-wrap gap-2">
            {Object.entries(CATEGORIES).map(([key, c]) => (
              <button key={key} type="button" className="chip" aria-pressed={category === key} onClick={() => setCategory(key)}>
                <span aria-hidden="true">{c.emoji}</span> {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Paid by">
            <select className="input" value={paidBy} onChange={(e) => setPaidBy(Number(e.target.value))}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id === meId ? 'You' : m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input className="input" type="date" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} required />
          </Field>
        </div>

        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">Split between</span>
            <div className="w-60 max-w-full">
              <Segmented label="How to split" options={SPLITS} value={splitType} onChange={setSplitType} />
            </div>
          </div>

          <ul className="grid gap-1.5">
            {members.map((m) => {
              const on = included.has(m.id);
              return (
                <li key={m.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2">
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(m.id)}
                      className="h-4 w-4 accent-[var(--brand)]"
                    />
                    <Avatar user={m} size={28} />
                    <span className="truncate text-sm font-medium">{m.id === meId ? 'You' : firstName(m.name)}</span>
                  </label>

                  {on && splitType !== 'equal' && (
                    <input
                      className="input !w-24 !py-1.5 text-right"
                      inputMode="decimal"
                      aria-label={`${m.name} ${splitType === 'percent' ? 'percent' : 'amount in rupees'}`}
                      placeholder={splitType === 'percent' ? '%' : '₹'}
                      value={values[m.id] ?? ''}
                      onChange={(e) => setValues((v) => ({ ...v, [m.id]: e.target.value }))}
                    />
                  )}
                  <span className="w-24 text-right text-sm font-semibold text-muted">
                    {on && amount ? inr(shares[m.id] || 0) : '—'}
                  </span>
                </li>
              );
            })}
          </ul>

          {problem && amount > 0 && <p className="text-sm font-medium text-neg">{problem}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={pickReceipt} aria-label="Attach receipt photo" />
          <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            <ImageIcon /> {receipt ? 'Change receipt' : 'Attach receipt'}
          </button>
          {receipt && (
            <span className="flex min-w-0 items-center gap-2 text-sm text-muted">
              <span className="truncate">{receipt.name}</span>
              <button
                type="button"
                className="font-semibold text-neg"
                onClick={() => {
                  setReceipt(null);
                  if (fileRef.current) fileRef.current.value = '';
                }}
              >
                Remove
              </button>
            </span>
          )}
        </div>

        <ErrorNote>{error}</ErrorNote>
        <button className="btn btn-accent" disabled={busy}>
          {busy ? 'Adding…' : amount ? `Add expense · ${inr(amount)}` : 'Add expense'}
        </button>
      </form>
    </Modal>
  );
}
