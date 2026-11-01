import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/auth';
import { useTheme } from '../context/theme';
import { ErrorNote, Field } from '../components/ui';
import { Logo, MoonIcon, SunIcon } from '../components/icons';

const DEMO = { email: 'demo@splitmate.app', password: 'demo1234' };

export default function Auth() {
  const { user, login, register } = useAuth();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={location.state?.from || '/'} replace />;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e, creds) {
    e?.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (creds) await login(creds.email, creds.password);
      else if (mode === 'login') await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-hero p-12 text-on-hero lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-2.5 font-display text-xl font-bold">
          <Logo size={32} /> SplitMate
        </div>

        <div className="max-w-md">
          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight">
            Split the bill, not the friendship.
          </h1>
          <p className="mt-5 text-lg text-hero-muted">
            Add what you spent, see who owes whom, and settle up over UPI in a couple of taps.
          </p>

          {/* A tiny worked example of what the app does, instead of a feature list. */}
          <div className="mt-10 grid gap-3 rounded-3xl bg-white/[0.07] p-5 text-sm">
            <div className="flex items-center justify-between">
              <span>Rohan paid for the villa</span>
              <strong className="font-display text-base">₹24,000</strong>
            </div>
            <div className="flex items-center justify-between text-hero-muted">
              <span>Split equally between 5</span>
              <span>₹4,800 each</span>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-white/10 pt-3">
              <span>Priya pays Rohan</span>
              <strong className="font-display text-base text-hero-pos">₹4,800</strong>
            </div>
          </div>
        </div>

        <p className="text-sm text-hero-muted">Amounts in ₹. Settle with any UPI app.</p>
      </aside>

      <section className="relative flex items-center justify-center px-5 py-12">
        <button
          type="button"
          className="btn btn-quiet absolute right-4 top-4 !px-2.5"
          onClick={toggle}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>

        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 font-display text-xl font-bold lg:hidden">
            <Logo size={32} /> SplitMate
          </div>

          <h2 className="font-display text-3xl font-bold tracking-tight">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="mt-1.5 text-muted">
            {mode === 'login' ? 'Sign in to see what you owe and are owed.' : 'Free, and ready in a few seconds.'}
          </p>

          <form onSubmit={submit} className="mt-7 grid gap-4">
            {mode === 'register' && (
              <Field label="Name">
                <input className="input" value={form.name} onChange={set('name')} required maxLength={60} autoComplete="name" />
              </Field>
            )}
            <Field label="Email">
              <input className="input" type="email" value={form.email} onChange={set('email')} required autoComplete="email" />
            </Field>
            <Field label="Password" hint={mode === 'register' ? 'At least 6 characters' : undefined}>
              <input
                className="input"
                type="password"
                value={form.password}
                onChange={set('password')}
                required
                minLength={mode === 'register' ? 6 : undefined}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </Field>
            <ErrorNote>{error}</ErrorNote>
            <button className="btn btn-accent" disabled={busy}>
              {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-muted">
            {mode === 'login' ? 'New to SplitMate?' : 'Already have an account?'}{' '}
            <button
              type="button"
              className="font-semibold text-brand underline-offset-2 hover:underline"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError('');
              }}
            >
              {mode === 'login' ? 'Create an account' : 'Sign in'}
            </button>
          </p>

          <div className="mt-8 rounded-2xl border border-dashed border-line p-4 text-center">
            <p className="text-sm text-muted">Just looking around?</p>
            <button type="button" className="btn btn-ghost mt-2 w-full" disabled={busy} onClick={() => submit(null, DEMO)}>
              Try the demo account
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
