import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { Modal } from './ui.jsx';

let gsiLoading;
function loadGoogle() {
  if (window.google?.accounts) return Promise.resolve();
  gsiLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return gsiLoading;
}

export default function Auth({ onClose, onUser }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [clientId, setClientId] = useState(null);
  const gbtn = useRef(null);

  useEffect(() => { api.get('/auth/config').then((c) => setClientId(c.googleClientId)).catch(() => {}); }, []);

  useEffect(() => {
    if (!clientId || !gbtn.current) return;
    let cancelled = false;
    loadGoogle().then(() => {
      if (cancelled) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          try { onUser((await api.post('/auth/google', { credential })).user); }
          catch (e) { setError(e.message); }
        },
      });
      window.google.accounts.id.renderButton(gbtn.current, { theme: 'filled_black', shape: 'pill', size: 'large', text: 'continue_with', width: 300 });
    }).catch(() => setError('Could not load Google sign-in'));
    return () => { cancelled = true; };
  }, [clientId, onUser]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const body = mode === 'signup' ? form : { email: form.email, password: form.password };
      onUser((await api.post(`/auth/${mode}`, body)).user);
    } catch (err) { setError(err.message); }
    setBusy(false);
  }

  return (
    <Modal onClose={onClose}>
      <span className="mono">// {mode === 'login' ? 'welcome back' : 'new entry'}</span>
      <h2>{mode === 'login' ? 'Sign in' : 'Start your archive'}</h2>
      <form onSubmit={submit}>
        {mode === 'signup' && <label className="field"><span className="mono">name</span><input value={form.name} onChange={set('name')} maxLength={60} required autoFocus /></label>}
        <label className="field"><span className="mono">email</span><input type="email" value={form.email} onChange={set('email')} required autoFocus={mode === 'login'} /></label>
        <label className="field"><span className="mono">password</span><input type="password" value={form.password} onChange={set('password')} minLength={mode === 'signup' ? 8 : undefined} required /></label>
        {error && <p className="err mono">! {error}</p>}
        <button className="pill solid big" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
          {busy ? 'working…' : mode === 'login' ? 'sign in →' : 'create account →'}
        </button>
      </form>
      {clientId && (<><div className="or mono">or</div><div className="gbtn" ref={gbtn} /></>)}
      <p className="switch mono">
        {mode === 'login' ? 'no account? ' : 'have one already? '}
        <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}>{mode === 'login' ? 'sign up' : 'sign in'}</button>
      </p>
    </Modal>
  );
}
