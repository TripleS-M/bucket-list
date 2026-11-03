const express = require('express');
const db = require('../db');
const { optionalAuth } = require('../middleware/auth');
const { serializeList, listItems } = require('../serialize');

const router = express.Router();
router.use(optionalAuth);

const SUMMARY_SQL = `
  SELECT l.*, u.name AS author_name, u.avatar_url AS author_avatar,
    (SELECT COUNT(*) FROM items i WHERE i.list_id = l.id) AS item_count,
    (SELECT COUNT(*) FROM items i WHERE i.list_id = l.id AND i.done = 1) AS done_count
  FROM lists l JOIN users u ON u.id = l.user_id`;

// Community feed. ?page=1&limit=20&q=search&sort=new|progress&author=<userId>
router.get('/lists', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
  const author = parseInt(req.query.author, 10) || null;

  const where = ['l.is_public = 1'];
  const params = [];
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    where.push("(l.title LIKE ? ESCAPE '\\' OR l.description LIKE ? ESCAPE '\\' OR u.name LIKE ? ESCAPE '\\')");
    params.push(like, like, like);
  }
  if (author) { where.push('l.user_id = ?'); params.push(author); }

  const order = req.query.sort === 'progress'
    ? 'CAST(done_count AS REAL) / MAX(item_count, 1) DESC, l.published_at DESC'
    : 'l.published_at DESC, l.id DESC';

  const total = db.prepare(`SELECT COUNT(*) AS c FROM lists l JOIN users u ON u.id = l.user_id WHERE ${where.join(' AND ')}`)
    .get(...params).c;
  const rows = db.prepare(`${SUMMARY_SQL} WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(...params, limit, (page - 1) * limit);

  // Short preview of items so the feed cards can show something without N extra requests.
  const preview = db.prepare('SELECT * FROM items WHERE list_id = ? ORDER BY position, id LIMIT 5');
  const lists = rows.map((r) => serializeList(r, preview.all(r.id).map((i) => ({
    id: i.id, text: i.text, done: !!i.done, doneAt: i.done_at, position: i.position,
  }))));

  res.json({ lists, page, limit, total, hasMore: page * limit < total });
});

router.get('/lists/:id', (req, res) => {
  const list = db.prepare(`${SUMMARY_SQL} WHERE l.id = ?`).get(Number(req.params.id));
  // The owner can preview their own unpublished list; everyone else only sees published ones.
  if (!list || (!list.is_public && list.user_id !== req.user?.id)) {
    return res.status(404).json({ error: 'List not found' });
  }
  res.json({ list: serializeList(list, listItems(list.id)) });
});

module.exports = router;
