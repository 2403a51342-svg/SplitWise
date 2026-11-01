import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../api';
import { useToast } from '../context/toast';
import { Avatar, ErrorNote, Field, Modal } from './ui';
import { inr, rupeesToPaise, upiLink } from '../utils';

/**
 * Settle one payment. If you are the payer and the person you owe has a UPI ID, the
 * button opens your UPI app with the amount pre-filled (and a QR for desktop). The payment is
 * recorded only when you confirm — UPI apps cannot tell a web page whether the payment went through.
 */
export default function SettleModal({ groupId, groupName, transfer, members, meId, onClose, onDone }) {
  const toast = useToast();
  const byId = Object.fromEntries(members.map((m) => [m.id, m]));
  const from = byId[transfer.from];
  const to = byId[transfer.to];
  const iPay = transfer.from === meId;

  const [amountText, setAmountText] = useState(String(transfer.amount / 100));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const paise = rupeesToPaise(amountText);
  const valid = paise > 0 && paise <= transfer.amount;
  const link =
    iPay && to.upiId && valid
      ? upiLink({ upiId: to.upiId, name: to.name, amountPaise: paise, note: `SplitMate: ${groupName}` })
      : null;

  async function record() {
    setBusy(true);
    setError('');
    try {
      await api(`/groups/${groupId}/settlements`, {
        method: 'POST',
        body: { fromUser: transfer.from, toUser: transfer.to, amount: paise },
      });
      toast(iPay ? `Recorded: you paid ${to.name.split(' ')[0]} ${inr(paise)}` : `Recorded: ${from.name.split(' ')[0]} paid you ${inr(paise)}`, 'success');
      onDone();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={iPay ? `Pay ${to.name.split(' ')[0]}` : `Record payment from ${from.name.split(' ')[0]}`} onClose={onClose}>
      <div className="grid gap-5">
        <div className="flex items-center justify-center gap-4 rounded-2xl bg-surface-2 py-4">
          <Avatar user={from} size={44} />
          <span className="font-display text-xl text-muted" aria-hidden="true">→</span>
          <Avatar user={to} size={44} />
        </div>

        <Field
          label="Amount (₹)"
          hint={
            paise > transfer.amount
              ? undefined
              : paise < transfer.amount && paise > 0
                ? `Partial payment. ${inr(transfer.amount - paise)} will still be owed.`
                : `Full amount owed: ${inr(transfer.amount)}`
          }
        >
          <input
            className="input"
            inputMode="decimal"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            aria-invalid={!valid}
          />
        </Field>
        {!valid && (
          <p className="-mt-3 text-sm font-medium text-neg">
            Enter an amount between ₹0.01 and {inr(transfer.amount)}.
          </p>
        )}

        {iPay &&
          (to.upiId ? (
            <div className="grid justify-items-center gap-3 rounded-2xl border border-line p-4">
              {link ? (
                <>
                  <div className="rounded-xl bg-white p-3">
                    <QRCodeSVG value={link} size={148} level="M" />
                  </div>
                  <p className="text-center text-xs text-muted">
                    On a computer? Scan with any UPI app.
                    <br />
                    Paying to <strong className="text-ink">{to.upiId}</strong>
                  </p>
                  <a href={link} className="btn btn-accent w-full">
                    Open UPI app and pay {inr(paise)}
                  </a>
                </>
              ) : (
                <p className="text-sm text-muted">Enter a valid amount to get the UPI link.</p>
              )}
            </div>
          ) : (
            <p className="rounded-2xl border border-line p-4 text-sm text-muted">
              {to.name.split(' ')[0]} has not added a UPI ID yet. Pay them any way you like, then record it below.
            </p>
          ))}

        <ErrorNote>{error}</ErrorNote>

        <button type="button" className={`btn ${iPay && link ? 'btn-ghost' : 'btn-accent'}`} disabled={!valid || busy} onClick={record}>
          {busy ? 'Saving…' : iPay ? "I've paid, record it" : 'Record payment received'}
        </button>
      </div>
    </Modal>
  );
}
