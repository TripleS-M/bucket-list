import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import Auth from './Auth.jsx';
import Home from './Home.jsx';
import MyLists from './MyLists.jsx';
import { Avatar, useClock } from './ui.jsx';

const routeFromHash = () => (location.hash.startsWith('#/mine') ? 'mine' : 'home');

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = still checking session
  const [route, setRoute] = useState(routeFromHash);
  const [authOpen, setAuthOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const time = useClock();

  useEffect(() => {
    api.get('/auth/me').then((r) => setUser(r.user)).catch(() => setUser(null));
    const h = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);

  const toast = useCallback((m) => { setMsg(m); setTimeout(() => setMsg(''), 3200); }, []);
  const onUser = useCallback((u) => { setUser(u); setAuthOpen(false); location.hash = '#/mine'; }, []);
  const goMine = () => (user ? (location.hash = '#/mine') : setAuthOpen(true));

  async function logout() {
    await api.post('/auth/logout').catch(() => {});
    setUser(null);
    location.hash = '#/';
  }

  const showMine = route === 'mine' && user;

  return (
    <>
      <div className="top">
        <a className="brand" href="#/"><i />Bucket List</a>
        <nav>
          <a className={`pill tube${!showMine ? ' on' : ''}`} href="#/">archive</a>
          <button className={`pill tube${showMine ? ' on' : ''}`} onClick={goMine}>my lists</button>
        </nav>
        <div className="right">
          <span className="clock mono">local time<br />{time}</span>
          {user ? (
            <>
              <span className="mono" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Avatar author={{ name: user.name, avatarUrl: user.avatarUrl }} />{user.name}</span>
              <button className="pill tube" onClick={logout}>sign out</button>
            </>
          ) : user === null && <button className="pill solid" onClick={() => setAuthOpen(true)}>sign in →</button>}
        </div>
      </div>

      {showMine ? <MyLists toast={toast} /> : <Home onStart={goMine} />}
      {authOpen && <Auth onClose={() => setAuthOpen(false)} onUser={onUser} />}
      {msg && <div className="toast tube mono">{msg}</div>}
    </>
  );
}
