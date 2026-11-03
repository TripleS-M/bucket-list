const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { serializeList, serializeItem, listItems } = require('../serialize');

const router = express.Router();
router.use(requireAuth);

const MAX_LISTS_PER_USER = 100;
const MAX_ITEMS_PER_LIST = 500;
const str = (v) => (typeof v === 'string' ? v.trim() : '');

const SUMMARY_SQL = `
  SELECT l.*, u.name AS author_name, u.avatar_url AS author_avatar,
    (SELECT COUNT(*) FROM items i WHERE i.list_id = l.id) AS item_count,
    (SELECT COUNT(*) FROM items i WHERE i.list_id = l.id AND i.done = 1) AS done_count
  FROM lists l JOIN users u ON u.id = l.user_id`;

// Loads a list only if it belongs to the logged-in user (404 otherwise, so ids don't leak).
function ownedList(req, res) {
  const list = db.prepare(`${SUMMARY_SQL} WHERE l.id = ? AND l.user_id = ?`).get(Number(req.params.id), req.user.id);
  if (!list) res.status(404).json({ error: 'List not found' });
  return list;
}

const touch = (listId) => db.prepare("UPDATE lists SET updated_at = datetime('now') WHERE id = ?").run(listId);
const nextPosition = (listId) =>
  db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM items WHERE list_id = ?').get(listId).p;

router.get('/', (req, res) => {
  const rows = db.prepare(`${SUMMARY_SQL} WHERE l.user_id = ? ORDER BY l.updated_at DESC, l.id DESC`).all(req.user.id);
  res.json({ lists: rows.map((r) => serializeList(r)) });
});

router.post('/', (req, res) => {
  const title = str(req.body.title);
  const description = str(req.body.description);
  const items = Array.isArray(req.body.items) ? req.body.items.map(str).filter(Boolean) : [];
  const isPublic = req.body.isPublic === true;

  if (!title || title.length > 120) return res.status(400).json({ error: 'Title required (max 120 chars)' });
  if (description.length > 1000) return res.status(400).json({ error: 'Description too long (max 1000)' });
  if (items.length > MAX_ITEMS_PER_LIST || items.some((t) => t.length > 300)) {
    return res.status(400).json({ error: `Max ${MAX_ITEMS_PER_LIST} items, 300 chars each` });
  }
  const count = db.prepare('SELECT COUNT(*) AS c FROM lists WHERE user_id = ?').get(req.user.id).c;
  if (count >= MAX_LISTS_PER_USER) return res.status(400).json({ error: 'List limit reached' });

  db.exec('BEGIN');
  let id;
  try {
    id = db.prepare(
      `INSERT INTO lists (user_id, title, description, is_public, published_at)
       VALUES (?, ?, ?, ?, CASE WHEN ? = 1 THEN datetime('now') END)`,
    ).run(req.user.id, title, description, isPublic ? 1 : 0, isPublic ? 1 : 0).lastInsertRowid;
    const ins = db.prepare('INSERT INTO items (list_id, text, position) VALUES (?, ?, ?)');
    items.forEach((t, i) => ins.run(id, t, i));
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  const list = db.prepare(`${SUMMARY_SQL} WHERE l.id = ?`).get(id);
  res.status(201).json({ list: serializeList(list, listItems(id)) });
});

router.get('/:id', (req, res) => {
  const list = ownedList(req, res);
  if (list) res.json({ list: serializeList(list, listItems(list.id)) });
});

// Edit title/description and publish/unpublish.
router.patch('/:id', (req, res) => {
  const list = ownedList(req, res);
  if (!list) return;

  const title = req.body.title === undefined ? list.title : str(req.body.title);
  const description = req.body.description === undefined ? list.description : str(req.body.description);
  if (!title || title.length > 120) return res.status(400).json({ error: 'Title required (max 120 chars)' });
  if (description.length > 1000) return res.status(400).json({ error: 'Description too long (max 1000)' });
  if (req.body.isPublic !== undefined && typeof req.body.isPublic !== 'boolean') {
    return res.status(400).json({ error: 'isPublic must be a boolean' });
  }
  const isPublic = req.body.isPublic === undefined ? !!list.is_public : req.body.isPublic;
  // published_at is set when first made public, cleared when unpublished.
  const publishedAt = isPublic ? list.published_at || new Date().toISOString().replace('T', ' ').slice(0, 19) : null;

  db.prepare(
    `UPDATE lists SET title = ?, description = ?, is_public = ?, published_at = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(title, description, isPublic ? 1 : 0, publishedAt, list.id);

  const updated = db.prepare(`${SUMMARY_SQL} WHERE l.id = ?`).get(list.id);
  res.json({ list: serializeList(updated, listItems(list.id)) });
});

router.delete('/:id', (req, res) => {
  const list = ownedList(req, res);
  if (!list) return;
  db.prepare('DELETE FROM lists WHERE id = ?').run(list.id);
  res.status(204).end();
});

// ---- items ----

router.post('/:id/items', (req, res) => {
  const list = ownedList(req, res);
  if (!list) return;
  const text = str(req.body.text);
  if (!text || text.length > 300) return res.status(400).json({ error: 'Text required (max 300 chars)' });
  if (list.item_count >= MAX_ITEMS_PER_LIST) return res.status(400).json({ error: 'Item limit reached' });

  const id = db.prepare('INSERT INTO items (list_id, text, position) VALUES (?, ?, ?)')
    .run(list.id, text, nextPosition(list.id)).lastInsertRowid;
  touch(list.id);
  res.status(201).json({ item: serializeItem(db.prepare('SELECT * FROM items WHERE id = ?').get(id)) });
});

// Edit text, check/uncheck (done), or move (position = 0-based index in the list).
router.patch('/:id/items/:itemId', (req, res) => {
  const list = ownedList(req, res);
  if (!list) return;
  const item = db.prepare('SELECT * FROM items WHERE id = ? AND list_id = ?').get(Number(req.params.itemId), list.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const { text, done, position } = req.body;
  if (text !== undefined && (!str(text) || str(text).length > 300)) {
    return res.status(400).json({ error: 'Text required (max 300 chars)' });
  }
  if (done !== undefined && typeof done !== 'boolean') return res.status(400).json({ error: 'done must be a boolean' });
  if (position !== undefined && !Number.isInteger(position)) return res.status(400).json({ error: 'position must be an integer' });

  db.exec('BEGIN');
  try {
    if (text !== undefined) db.prepare('UPDATE items SET text = ? WHERE id = ?').run(str(text), item.id);
    if (done !== undefined && done !== !!item.done) {
      db.prepare("UPDATE items SET done = ?, done_at = CASE WHEN ? = 1 THEN datetime('now') END WHERE id = ?")
        .run(done ? 1 : 0, done ? 1 : 0, item.id);
    }
    if (position !== undefined) {
      const ids = db.prepare('SELECT id FROM items WHERE list_id = ? AND id != ? ORDER BY position, id')
        .all(list.id, item.id).map((r) => r.id);
      ids.splice(Math.max(0, Math.min(position, ids.length)), 0, item.id);
      const upd = db.prepare('UPDATE items SET position = ? WHERE id = ?');
      ids.forEach((id, i) => upd.run(i, id));
    }
    touch(list.id);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  res.json({ item: serializeItem(db.prepare('SELECT * FROM items WHERE id = ?').get(item.id)) });
});

router.delete('/:id/items/:itemId', (req, res) => {
  const list = ownedList(req, res);
  if (!list) return;
  const { changes } = db.prepare('DELETE FROM items WHERE id = ? AND list_id = ?').run(Number(req.params.itemId), list.id);
  if (!changes) return res.status(404).json({ error: 'Item not found' });
  touch(list.id);
  res.status(204).end();
});

module.exports = router;
