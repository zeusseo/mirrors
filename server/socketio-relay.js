const { createServer } = require('http');
const { Server } = require('socket.io');
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');

const PORT = process.env.PORT || 3100;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'recordings.db');

/* ── Express + HTTP ── */
const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

/* ── SQLite ── */
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL'); // 성능 최적화

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    uid       TEXT PRIMARY KEY,
    started   INTEGER NOT NULL,
    ended     INTEGER
  );

  CREATE TABLE IF NOT EXISTS events (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    uid       TEXT NOT NULL,
    seq       INTEGER NOT NULL,
    data      TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (uid) REFERENCES sessions(uid)
  );

  CREATE INDEX IF NOT EXISTS idx_events_uid ON events(uid, seq);
`);

const insertSession = db.prepare(
  'INSERT OR IGNORE INTO sessions (uid, started) VALUES (?, ?)'
);
const endSession = db.prepare(
  'UPDATE sessions SET ended = ? WHERE uid = ? AND ended IS NULL'
);
const insertEvent = db.prepare(
  'INSERT INTO events (uid, seq, data, timestamp) VALUES (?, ?, ?, ?)'
);

// Per-session sequence counter (in-memory, resets on server restart)
const seqCounters = new Map();
function nextSeq(uid) {
  const seq = (seqCounters.get(uid) || 0) + 1;
  seqCounters.set(uid, seq);
  return seq;
}

/* ── REST API ── */

// GET /api/sessions — 세션 목록
app.get('/api/sessions', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT uid, started, ended,
              (SELECT COUNT(*) FROM events e WHERE e.uid = s.uid) as eventCount
       FROM sessions s
       ORDER BY started DESC
       LIMIT 100`
    )
    .all();
  res.json(rows);
});

// GET /api/sessions/:uid — 특정 세션의 이벤트 (재생용)
app.get('/api/sessions/:uid', (req, res) => {
  const { uid } = req.params;

  const session = db
    .prepare('SELECT uid, started, ended FROM sessions WHERE uid = ?')
    .get(uid);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const events = db
    .prepare('SELECT data FROM events WHERE uid = ? ORDER BY seq ASC')
    .all(uid)
    .map((row) => JSON.parse(row.data));

  res.json({ session, events });
});

// DELETE /api/sessions/:uid — 세션 삭제
app.delete('/api/sessions/:uid', (req, res) => {
  const { uid } = req.params;
  db.prepare('DELETE FROM events WHERE uid = ?').run(uid);
  db.prepare('DELETE FROM sessions WHERE uid = ?').run(uid);
  res.json({ ok: true });
});

/* ── Socket.IO ── */

// Track embed sockets per room for targeted routing
const embedSockets = new Map();

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  socket.on('join', ({ uid, role }) => {
    socket.join(uid);
    socket.data.uid = uid;
    socket.data.role = role;

    if (role === 'embed') {
      embedSockets.set(uid, socket.id);
      // 세션 생성
      insertSession.run(uid, Date.now());
      seqCounters.set(uid, 0);
      console.log(`[session] created for ${uid}`);
    }

    console.log(`[join] ${socket.id} → room:${uid} (${role})`);
  });

  socket.on('mirrors', (data) => {
    const { uid, role } = socket.data;
    if (!uid) return;

    if (role === 'embed') {
      // Embed → broadcast to ALL Apps in the room
      socket.to(uid).emit('mirrors', data);

      // DB에 이벤트 저장 (SendRecord 이벤트만)
      if (data.payload && data.payload.data) {
        try {
          const seq = nextSeq(uid);
          const eventData = JSON.stringify(data.payload.data);
          const timestamp = data.payload.data.timestamp || Date.now();
          insertEvent.run(uid, seq, eventData, timestamp);
        } catch (err) {
          console.error('[db] insert error:', err.message);
        }
      }
    } else {
      // App → send ONLY to the Embed socket (not to other Apps)
      const embedSocketId = embedSockets.get(uid);
      if (embedSocketId) {
        io.to(embedSocketId).emit('mirrors', data);
      }
    }
  });

  socket.on('disconnect', (reason) => {
    const { uid, role } = socket.data;
    if (role === 'embed' && uid) {
      embedSockets.delete(uid);
      // 세션 종료 시각 기록
      endSession.run(Date.now(), uid);
      console.log(`[session] ended for ${uid}`);
    }
    console.log(`[disconnect] ${socket.id} (${reason})`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Mirrors relay server listening on port ${PORT}`);
  console.log(`  Socket.IO: ws://localhost:${PORT}`);
  console.log(`  REST API:  http://localhost:${PORT}/api/sessions`);
  console.log(`  DB path:   ${DB_PATH}`);
});
