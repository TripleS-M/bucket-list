const db = require('./db');

const serializeItem = (i) => ({
  id: i.id,
  text: i.text,
  done: !!i.done,
  doneAt: i.done_at,
  position: i.position,
});

const listItems = (listId) =>
  db.prepare('SELECT * FROM items WHERE list_id = ? ORDER BY position, id').all(listId).map(serializeItem);

// `l` is a row from the list summary query (list columns + author_* + item_count/done_count).
const serializeList = (l, items) => ({
  id: l.id,
  title: l.title,
  description: l.description,
  isPublic: !!l.is_public,
  publishedAt: l.published_at,
  createdAt: l.created_at,
  updatedAt: l.updated_at,
  itemCount: l.item_count,
  doneCount: l.done_count,
  author: { id: l.user_id, name: l.author_name, avatarUrl: l.author_avatar },
  ...(items && { items }),
});

module.exports = { serializeItem, serializeList, listItems };
