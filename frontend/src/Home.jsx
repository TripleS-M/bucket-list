import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { Avatar, Modal, Segments, Tick, pad, pct } from './ui.jsx';

function Hero({ stats, onStart }) {
  const bars = [6, 9, 12, 15, 18];
  const level = Math.max(1, Math.round((stats.pct / 100) * bars.length));
  return (
    <header className="hero">
      <img className="chrome" src="/chrome2.jpg" alt="" />
      <div className="hero-top mono">
        <div className="marks">
          <span>// discover</span><span>// plan</span><span>// do it anyway</span>
          <div className="squares"><i /><i /><i /><i /></div>
        </div>
        <div style={{ textAlign: 'right' }}>archive 09</div>
      </div>

      <div className="widgets">
        <div className="widget tube dark">
          <div className="mono">signal strength</div>
          <div className="bars">{bars.map((h, i) => <i key={i} style={{ height: h, opacity: i < level ? 1 : 0.25 }} />)}</div>
        </div>
        <div className="widget tube dark">
          <div className="mono">community done</div>
          <div className="big">{stats.pct}%</div>
        </div>
        <div className="widget tube dark">
          <div className="mono">lists broadcasting</div>
          <div className="big">{pad(stats.lists, 3)}</div>
        </div>
      </div>

      <h1>Everything you haven’t <em>done</em> yet.</h1>

      <div className="hero-bottom">
        <div>
          <p>Write the list. Cross things off. Publish it to the archive so everyone else can see what you’re chasing.</p>
          <div className="ctas">
            <button className="pill solid big" onClick={onStart}>start a list →</button>
            <a className="pill tube dark big" href="#archive">read the archive ↓</a>
          </div>
        </div>
      </div>
    </header>
  );
}

function Card({ list, onOpen }) {
  const shown = list.items.slice(0, 4);
  const rest = list.itemCount - shown.length;
  return (
    <button className={`card t${list.id % 3}`} onClick={() => onOpen(list.id)}>
      <div className="card-top mono"><span>no.{pad(list.id)}</span><span>{pct(list.doneCount, list.itemCount)}%</span></div>
      <h3>{list.title}</h3>
      {list.description && <p className="desc">{list.description}</p>}
      <ul>
        {shown.map((i) => (
          <li key={i.id} className={i.done ? 'done' : ''}>
            <span className={`sq${i.done ? ' on' : ''}`}>{i.done && <Tick size={9} />}</span>
            <span className="strike">{i.text}</span>
          </li>
        ))}
        {rest > 0 && <li className="more mono">+ {rest} more</li>}
      </ul>
      <Segments done={list.doneCount} total={list.itemCount} />
      <div className="card-foot mono">
        <span className="author"><Avatar author={list.author} />{list.author.name}</span>
        <span>{list.doneCount}/{list.itemCount} done</span>
      </div>
    </button>
  );
}

function Viewer({ id, onClose }) {
  const [list, setList] = useState(null);
  useEffect(() => { api.get(`/public/lists/${id}`).then((r) => setList(r.list)).catch(onClose); }, [id, onClose]);
  return (
    <Modal onClose={onClose} wide>
      {!list ? <p className="mono">loading…</p> : (
        <>
          <span className="mono">no.{pad(list.id)} — by {list.author.name}</span>
          <h2>{list.title}</h2>
          {list.description && <p>{list.description}</p>}
          <ul className="view-items">
            {list.items.map((i) => (
              <li key={i.id} className={i.done ? 'done' : ''}>
                <span className={`sq${i.done ? ' on' : ''}`}>{i.done && <Tick size={11} />}</span>
                <span className="strike">{i.text}</span>
              </li>
            ))}
          </ul>
          <Segments done={list.doneCount} total={list.itemCount} n={24} />
          <span className="mono">{list.doneCount} of {list.itemCount} done — {pct(list.doneCount, list.itemCount)}%</span>
        </>
      )}
    </Modal>
  );
}

export default function Home({ onStart }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('new');
  const [data, setData] = useState({ lists: [], total: 0, page: 1, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);
  const [stats, setStats] = useState({ pct: 0, lists: 0 });

  const load = useCallback(async (page, replace) => {
    setLoading(true);
    const r = await api.get(`/public/lists?limit=12&page=${page}&sort=${sort}&q=${encodeURIComponent(q)}`).catch(() => null);
    if (r) setData((d) => ({ ...r, lists: replace ? r.lists : [...d.lists, ...r.lists] }));
    setLoading(false);
  }, [q, sort]);

  useEffect(() => { const t = setTimeout(() => load(1, true), 200); return () => clearTimeout(t); }, [load]);

  useEffect(() => {
    // headline numbers for the hero widgets
    api.get('/public/lists?limit=50').then((r) => {
      const done = r.lists.reduce((s, l) => s + l.doneCount, 0);
      const all = r.lists.reduce((s, l) => s + l.itemCount, 0);
      setStats({ pct: pct(done, all), lists: r.total });
    }).catch(() => {});
  }, []);

  return (
    <>
      <Hero stats={stats} onStart={onStart} />
      <main className="wrap" id="archive">
        <div className="sec-head">
          <h2><small>// published by everyone</small>The archive</h2>
          <div className="tools">
            <input className="search tube" placeholder="search lists, people…" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className={`pill tube${sort === 'new' ? ' on' : ''}`} onClick={() => setSort('new')}>newest</button>
            <button className={`pill tube${sort === 'progress' ? ' on' : ''}`} onClick={() => setSort('progress')}>most done</button>
          </div>
        </div>

        {!loading && !data.lists.length && <p className="empty mono">nothing here yet. be the first to publish a list.</p>}
        <div className="grid">{data.lists.map((l) => <Card key={l.id} list={l} onOpen={setOpen} />)}</div>
        {data.hasMore && <div className="loadmore"><button className="pill tube big" onClick={() => load(data.page + 1, false)}>load more ↓</button></div>}
      </main>
      <footer className="mono">
        <span>bucket list — archive 09</span>
        <span>{pad(data.total, 3)} lists broadcasting</span>
      </footer>
      {open && <Viewer id={open} onClose={() => setOpen(null)} />}
    </>
  );
}
