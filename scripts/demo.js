// Runs the API on :3001 against a separate demo database, filled with sample lists.
// Your real database (data/bucketlist.db) is never touched.
process.env.DB_PATH = './data/demo.db';
process.env.PORT = '3001';

const bcrypt = require('bcryptjs');
const db = require('../src/db');

const people = [
  ['Mara Okonkwo', [
    ['Small impossible things', 'Nothing here is useful. That is the point.', [
      ['Sleep on a night train across a border', 1], ['Learn to whistle with two fingers', 1],
      ['Swim in a lake that is above 3,000 m', 0], ['Write one letter a month for a year', 0],
      ['Bake bread from a starter I raised myself', 1], ['Stand under a total solar eclipse', 0]]],
  ]],
  ['Jun Takahashi', [
    ['Japan, slowly', 'No rail pass. Walk the Nakasendo, eat everything.', [
      ['Walk the Nakasendo, Magome to Tsumago', 1], ['Soak in a snow-covered onsen', 1],
      ['Eat at a counter with only 6 seats', 1], ['Visit Naoshima in the off season', 0],
      ['Catch the cherry blossoms in Hirosaki', 0]]],
    ['Learn by hand', '', [['Throw a bowl that holds water', 0], ['Sharpen a knife properly', 1], ['Repair my own bike', 1]]],
  ]],
  ['Ines Valdés', [
    ['Before I turn 30', 'Four months left.', [
      ['Run a half marathon', 1], ['Get a tattoo I have thought about for 3 years', 1],
      ['Quit the job that is eating me', 1], ['Move somewhere I can see mountains', 0],
      ['Speak Portuguese at a dinner table', 0], ['Pay off the last card', 1],
      ['Sing in front of strangers', 0], ['Visit Lisbon again, alone', 0]]],
  ]],
  ['Theo Lindqvist', [
    ['Night sky checklist', '', [
      ['See the aurora from Tromso', 0], ['Spot the Andromeda galaxy by eye', 1],
      ['Watch the Perseids from a dark site', 1], ['Photograph the Milky Way core', 0]]],
  ]],
  ['Amara Singh', [
    ['Cold water, big water', 'Open water is the only place my head goes quiet.', [
      ['Swim the length of a fjord', 0], ['Dive with manta rays', 0], ['Cross a river on foot, no bridge', 1],
      ['Learn to surf, properly', 1], ['Sleep on a boat for a week', 0]]],
    ['Tiny rituals', '', [['Read 24 books this year', 1], ['Cook every recipe from one cookbook', 0],
      ['Call my grandmother every Sunday', 1]]],
  ]],
  ['Kofi Mensah', [
    ['Make a thing', 'Ship something small that strangers use.', [
      ['Release an app with 100 real users', 1], ['Write and print a zine', 1],
      ['Give a talk at a conference', 0], ['Build a synthesizer from a kit', 0]]],
  ]],
];

if (!db.prepare('SELECT 1 FROM users LIMIT 1').get()) {
  const hash = bcrypt.hashSync('demo-password-123', 10);
  const user = db.prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)');
  const list = db.prepare(
    "INSERT INTO lists (user_id, title, description, is_public, published_at) VALUES (?, ?, ?, 1, datetime('now', ?))");
  const item = db.prepare(
    "INSERT INTO items (list_id, text, done, done_at, position) VALUES (?, ?, ?, CASE WHEN ? = 1 THEN datetime('now') END, ?)");
  let n = 0;
  people.forEach(([name, lists], pi) => {
    const uid = user.run(`demo${pi}@example.com`, name, hash).lastInsertRowid;
    for (const [title, desc, items] of lists) {
      const lid = list.run(uid, title, desc, `-${n++} hours`).lastInsertRowid;
      items.forEach(([t, d], i) => item.run(lid, t, d, d, i));
    }
  });
  console.log('Seeded demo data into data/demo.db');
}

require('../src/server');
