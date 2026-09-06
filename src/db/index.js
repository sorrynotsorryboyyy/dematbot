// Couche de persistance : SQLite integre a Node (node:sqlite, Node >= 22.5).
// Aucune dependance native a compiler.

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || join(__dirname, '..', '..', 'data.db');

export const db = new DatabaseSync(DB_PATH);

// Le schema est rejoue a chaque demarrage : tout est en CREATE ... IF NOT EXISTS.
db.exec(readFileSync(join(__dirname, 'schema.sql'), 'utf8'));

const now = () => Date.now();

// --- settings : ids de salons et de roles resolus au setup -------------------

export const settings = {
  get(key, fallback = null) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : fallback;
  },
  set(key, value) {
    db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    ).run(key, String(value));
  },
  all() {
    return db.prepare('SELECT key, value FROM settings').all();
  },
};

// Raccourcis pour les ids memorises par /setup.
export const channelId = (key) => settings.get(`channel:${key}`);
export const roleId = (key) => settings.get(`role:${key}`);
export const setChannelId = (key, id) => settings.set(`channel:${key}`, id);
export const setRoleId = (key, id) => settings.set(`role:${key}`, id);

// --- games -------------------------------------------------------------------

export const games = {
  list() {
    return db.prepare('SELECT * FROM games ORDER BY created_at ASC').all();
  },
  byName(name) {
    return db.prepare('SELECT * FROM games WHERE name = ?').get(name);
  },
  count() {
    return db.prepare('SELECT COUNT(*) AS n FROM games').get().n;
  },
  upsert(g) {
    const existing = this.byName(g.name);
    if (existing) {
      db.prepare(
        `UPDATE games SET genre = ?, age = ?, price = ?, description = ?, url = ?, image = ?
         WHERE name = ?`,
      ).run(g.genre ?? null, g.age ?? null, g.price ?? null, g.description ?? null, g.url ?? null, g.image ?? null, g.name);
      return this.byName(g.name);
    }
    db.prepare(
      `INSERT INTO games (name, genre, age, price, description, url, image, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(g.name, g.genre ?? null, g.age ?? null, g.price ?? null, g.description ?? null, g.url ?? null, g.image ?? null, now());
    return this.byName(g.name);
  },
  setMessage(name, messageId) {
    db.prepare('UPDATE games SET message_id = ? WHERE name = ?').run(messageId, name);
  },
  setThread(name, threadId) {
    db.prepare('UPDATE games SET thread_id = ? WHERE name = ?').run(threadId, name);
  },
  remove(name) {
    db.prepare('DELETE FROM games WHERE name = ?').run(name);
  },
};

// --- tickets -----------------------------------------------------------------

export const tickets = {
  create({ userId, type, subject = null }) {
    const info = db
      .prepare('INSERT INTO tickets (user_id, type, subject, created_at) VALUES (?, ?, ?, ?)')
      .run(userId, type, subject, now());
    return Number(info.lastInsertRowid);
  },
  attachChannel(id, channelId) {
    db.prepare('UPDATE tickets SET channel_id = ? WHERE id = ?').run(channelId, id);
  },
  byChannel(channelId) {
    return db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(channelId);
  },
  byId(id) {
    return db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
  },
  openForUser(userId, type) {
    return db
      .prepare("SELECT * FROM tickets WHERE user_id = ? AND type = ? AND status != 'closed'")
      .all(userId, type);
  },
  setStatus(id, status, claimedBy = null) {
    if (claimedBy) {
      db.prepare('UPDATE tickets SET status = ?, claimed_by = ? WHERE id = ?').run(status, claimedBy, id);
    } else {
      db.prepare('UPDATE tickets SET status = ? WHERE id = ?').run(status, id);
    }
  },
  close(id) {
    db.prepare("UPDATE tickets SET status = 'closed', closed_at = ? WHERE id = ?").run(now(), id);
  },
};

// --- submissions (formulaire dev) -------------------------------------------

export const submissions = {
  create(data) {
    const info = db
      .prepare(
        `INSERT INTO submissions (ticket_id, user_id, game_name, stage, copies, edition, team_size, url, contact, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        data.ticketId ?? null,
        data.userId,
        data.gameName ?? null,
        data.stage ?? null,
        data.copies ?? null,
        data.edition ?? null,
        data.teamSize ?? null,
        data.url ?? null,
        data.contact ?? null,
        data.notes ?? null,
        now(),
      );
    return Number(info.lastInsertRowid);
  },
  byTicket(ticketId) {
    return db.prepare('SELECT * FROM submissions WHERE ticket_id = ?').get(ticketId);
  },
};

// --- warns -------------------------------------------------------------------

export const warns = {
  add(userId, moderatorId, reason) {
    db.prepare('INSERT INTO warns (user_id, moderator_id, reason, created_at) VALUES (?, ?, ?, ?)').run(
      userId,
      moderatorId,
      reason ?? null,
      now(),
    );
    return this.count(userId);
  },
  list(userId) {
    return db.prepare('SELECT * FROM warns WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  },
  count(userId) {
    return db.prepare('SELECT COUNT(*) AS n FROM warns WHERE user_id = ?').get(userId).n;
  },
  clear(userId) {
    db.prepare('DELETE FROM warns WHERE user_id = ?').run(userId);
  },
};

// --- rolepanels --------------------------------------------------------------

export const rolepanels = {
  save(messageId, channelId, kind, roleIds) {
    db.prepare(
      `INSERT INTO rolepanels (message_id, channel_id, kind, roles_json) VALUES (?, ?, ?, ?)
       ON CONFLICT(message_id) DO UPDATE SET roles_json = excluded.roles_json`,
    ).run(messageId, channelId, kind, JSON.stringify(roleIds));
  },
  byKind(kind) {
    return db.prepare('SELECT * FROM rolepanels WHERE kind = ?').all(kind);
  },
  clearKind(kind) {
    db.prepare('DELETE FROM rolepanels WHERE kind = ?').run(kind);
  },
};
