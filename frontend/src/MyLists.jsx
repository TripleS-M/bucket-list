import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { AutoText, Segments, Tick, pad, pct } from './ui.jsx';

export default function MyLists({ toast }) {
  const [lists, setLists] = useState(null);
  const [sel, setSel] = useState(null); // full selected list
  const [newItem, setNewItem] = useState('');
  const [drag, setDrag] = useState({ from: null, over: null });
  const titleRef = useRef(null);
  const fail = (e) => toast(e.message);

  async function open(id) { setSel((await api.get(`/lists/${id}`)).list); }

  useEffect(() => {
    api.get('/lists').then((r) => { setLists(r.lists); if (r.lists[0]) open(r.lists[0].id); }).catch(fail);
  }, []);

  // keep the sidebar summary in step with the edited list
  function sync(next) {
    setSel(next);
    const done = next.items.filter((i) => i.done).length;
    setLists((ls) => ls.map((l) => (l.id === next.id ? { ...l, title: next.title, isPublic: next.isPublic, itemCount: next.items.length, doneCount: done } : l)));
  }

  async function create() {
    try {
      const { list } = await api.post('/lists', { title: 'Untitled list' });
      setLists((ls) => [list, ...ls]);
      setSel(list);
      setTimeout(() => titleRef.current?.select(), 50);
    } catch (e) { fail(e); }
  }

  async function saveMeta(patch) {
    const prev = sel;
    sync({ ...sel, ...patch });
    try { await api.patch(`/lists/${sel.id}`, patch); }
    catch (e) { sync(prev); fail(e); }
  }

  async function toggle(item) {
    const prev = sel;
    sync({ ...sel, items: sel.items.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)) });
    try { await api.patch(`/lists/${sel.id}/items/${item.id}`, { done: !item.done }); }
    catch (e) { sync(prev); fail(e); }
  }

  async function addItem(e) {
    e.preventDefault();
    const text = newItem.trim();
    if (!text) return;
    setNewItem('');
    try {
      const { item } = await api.post(`/lists/${sel.id}/items`, { text });
      sync({ ...sel, items: [...sel.items, item] });
    } catch (err) { setNewItem(text); fail(err); }
  }

  async function editText(item, text) {
    text = text.trim();
    if (text === item.text) return;
    if (!text) return sync({ ...sel, items: [...sel.items] }); // revert empty edit
    sync({ ...sel, items: sel.items.map((i) => (i.id === item.id ? { ...i, text } : i)) });
    api.patch(`/lists/${sel.id}/items/${item.id}`, { text }).catch(fail);
  }

  async function removeItem(item) {
    sync({ ...sel, items: sel.items.filter((i) => i.id !== item.id) });
    api.del(`/lists/${sel.id}/items/${item.id}`).catch(fail);
  }

  function drop(to) {
    const { from } = drag;
    setDrag({ from: null, over: null });
    if (from === null || from === to) return;
    const items = [...sel.items];
    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
    sync({ ...sel, items });
    api.patch(`/lists/${sel.id}/items/${moved.id}`, { position: to }).catch(fail);
  }

  async function removeList() {
    if (!window.confirm(`Delete “${sel.title}”? This can’t be undone.`)) return;
    try {
      await api.del(`/lists/${sel.id}`);
      const rest = lists.filter((l) => l.id !== sel.id);
      setLists(rest);
      rest[0] ? open(rest[0].id) : setSel(null);
    } catch (e) { fail(e); }
  }

  if (!lists) return <p className="wrap mono" style={{ padding: '120px 32px' }}>loading…</p>;

  if (!lists.length) {
    return (
      <div className="wrap zero">
        <span className="mono">// 000 lists</span>
        <h2>Nothing on the list.<br />Yet.</h2>
        <button className="pill solid big" onClick={create}>write the first one →</button>
      </div>
    );
  }

  const done = sel?.items.filter((i) => i.done).length ?? 0;

  return (
    <main className="wrap">
      <div className="sec-head" style={{ paddingTop: 64, paddingBottom: 0 }}>
        <h2><small>// private until you broadcast</small>Your lists</h2>
        <button className="pill solid big" onClick={create}>+ new list</button>
      </div>
      <div className="studio">
        <aside className="rail">
          {lists.map((l) => (
            <button key={l.id} className={`rail-item tube${sel?.id === l.id ? ' sel' : ''}`} onClick={() => open(l.id)}>
              <span className="mono">no.{pad(l.id)} {l.isPublic ? '· broadcasting' : '· private'}</span>
              <b>{l.title}</b>
              <Segments done={l.doneCount} total={l.itemCount} />
              <span className="mono">{l.doneCount}/{l.itemCount} done</span>
            </button>
          ))}
        </aside>

        {sel && (
          <section className="editor" key={sel.id}>
            <AutoText inputRef={titleRef} className="title-in" defaultValue={sel.title} maxLength={120} aria-label="List title"
              onBlur={(e) => { const t = e.target.value.trim(); if (t && t !== sel.title) saveMeta({ title: t }); else e.target.value = sel.title; }} />
            <AutoText className="desc-in" defaultValue={sel.description} placeholder="add a description…" maxLength={1000} aria-label="Description"
              onBlur={(e) => e.target.value.trim() !== sel.description && saveMeta({ description: e.target.value.trim() })} />

            <div className="ed-bar">
              <div>
                <Segments done={done} total={sel.items.length} n={20} />
                <span className="mono">{done} of {sel.items.length} done — {pct(done, sel.items.length)}%</span>
              </div>
              <div className="bcast">
                <span className="mono">{sel.isPublic && <i className="live" />}{sel.isPublic ? 'broadcasting to the archive' : 'private'}</span>
                <button className={`toggle${sel.isPublic ? ' on' : ''}`} role="switch" aria-checked={sel.isPublic} aria-label="Publish to the archive"
                  onClick={() => saveMeta({ isPublic: !sel.isPublic })} />
              </div>
            </div>

            <ul className="items">
              {sel.items.map((item, idx) => (
                <li key={item.id} className={`row${item.done ? ' done' : ''}${drag.over === idx && drag.from !== idx ? ' over' : ''}${drag.from === idx ? ' drag' : ''}`}
                  draggable onDragStart={() => setDrag({ from: idx, over: null })} onDragOver={(e) => { e.preventDefault(); setDrag((d) => ({ ...d, over: idx })); }}
                  onDrop={() => drop(idx)} onDragEnd={() => setDrag({ from: null, over: null })}>
                  <span className="grip" aria-hidden>⋮⋮</span>
                  <button className="chk" role="checkbox" aria-checked={item.done} aria-label={`Mark “${item.text}” ${item.done ? 'not done' : 'done'}`} onClick={() => toggle(item)}><Tick size={14} /></button>
                  <AutoText className="txt" defaultValue={item.text} maxLength={300} aria-label="Item text" key={item.text}
                    onBlur={(e) => editText(item, e.target.value)} />
                  <button className="del" onClick={() => removeItem(item)} aria-label="Delete item">×</button>
                </li>
              ))}
            </ul>

            <form className="add" onSubmit={addItem}>
              <input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="something you want to do…" maxLength={300} aria-label="New item" />
              <button className="pill solid big">add →</button>
            </form>
            <button className="pill danger" style={{ marginTop: 36 }} onClick={removeList}>delete this list</button>
          </section>
        )}
      </div>
    </main>
  );
}
