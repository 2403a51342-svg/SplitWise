import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useToast } from '../context/toast';
import { ErrorNote, Field, Modal } from './ui';

const EMOJIS = ['🏖️', '🏠', '⛰️', '🍕', '✈️', '🎉', '🎬', '🛒', '💼', '🏏'];

export default function NewGroupModal({ onClose }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [emails, setEmails] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const memberEmails = emails.split(/[\s,;]+/).filter(Boolean);
      const { id, notFound } = await api('/groups', { method: 'POST', body: { name, emoji, memberEmails } });
      if (notFound.length) {
        toast(`No account yet for ${notFound.join(', ')}. Ask them to sign up, then add them to the group.`, 'info');
      } else {
        toast('Group created', 'success');
      }
      onClose();
      navigate(`/groups/${id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title="New group" onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4">
        <Field label="Group name">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Goa trip, Flat 402, Office lunch…"
            required
            maxLength={40}
          />
        </Field>

        <div className="grid gap-1.5 text-sm">
          <span className="font-medium">Icon</span>
          <div className="flex flex-wrap gap-2">
            {EMOJIS.map((em) => (
              <button
                key={em}
                type="button"
                aria-pressed={emoji === em}
                aria-label={`Use ${em}`}
                onClick={() => setEmoji(em)}
                className="chip !px-3 !py-2 text-lg"
              >
                {em}
              </button>
            ))}
          </div>
        </div>

        <Field label="Add friends by email" hint="Separate several emails with commas. They need a SplitMate account.">
          <textarea
            className="input min-h-20 resize-y"
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="priya@splitmate.app, rohan@splitmate.app"
          />
        </Field>

        <ErrorNote>{error}</ErrorNote>
        <button className="btn btn-accent" disabled={busy}>
          {busy ? 'Creating…' : 'Create group'}
        </button>
      </form>
    </Modal>
  );
}
