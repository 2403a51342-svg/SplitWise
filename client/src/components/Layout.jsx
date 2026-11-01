import { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/auth';
import { useLive } from '../context/live';
import { useTheme } from '../context/theme';
import { useToast } from '../context/toast';
import { Avatar, ErrorNote, Field, Modal } from './ui';
import { LogoutIcon, Logo, MoonIcon, SunIcon } from './icons';

function ProfileModal({ onClose }) {
  const { user, updateProfile } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [upiId, setUpiId] = useState(user.upiId || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await updateProfile({ name, upiId });
      toast('Profile saved', 'success');
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Your profile" onClose={onClose}>
      <form onSubmit={save} className="grid gap-4">
        <Field label="Name">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
        </Field>
        <Field label="UPI ID" hint="Friends use this to pay you. Example: yourname@okhdfcbank">
          <input
            className="input"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder="yourname@bank"
            autoCapitalize="none"
            autoCorrect="off"
          />
        </Field>
        <ErrorNote>{error}</ErrorNote>
        <button className="btn btn-accent" disabled={busy}>
          {busy ? 'Saving…' : 'Save profile'}
        </button>
      </form>
    </Modal>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { connected } = useLive();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 rounded-lg font-display text-xl font-bold">
            <Logo />
            SplitMate
          </Link>

          <span
            className="ml-1 hidden items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted sm:inline-flex"
            title={connected ? 'Changes from friends appear instantly' : 'Reconnecting…'}
          >
            <span
              className={`h-2 w-2 rounded-full ${connected ? 'bg-pos' : 'bg-accent'}`}
              aria-hidden="true"
            />
            {connected ? 'Live' : 'Reconnecting'}
          </span>

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              className="btn btn-quiet !px-2.5"
              onClick={toggle}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl p-1.5 pr-2.5 hover:bg-surface-2"
              onClick={() => setProfileOpen(true)}
              aria-label="Edit your profile"
            >
              <Avatar user={user} size={32} />
              <span className="hidden text-sm font-semibold sm:inline">{user.name.split(' ')[0]}</span>
            </button>
            <button type="button" className="btn btn-quiet !px-2.5" onClick={logout} aria-label="Sign out">
              <LogoutIcon />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>

      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
    </div>
  );
}
