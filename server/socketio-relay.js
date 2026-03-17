const { createServer } = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3100;

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Track embed sockets per room for targeted routing
// Map<uid, socketId>
const embedSockets = new Map();

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  socket.on('join', ({ uid, role }) => {
    socket.join(uid);
    socket.data.uid = uid;
    socket.data.role = role;

    if (role === 'embed') {
      embedSockets.set(uid, socket.id);
    }

    console.log(`[join] ${socket.id} → room:${uid} (${role})`);
  });

  socket.on('syncit', (data) => {
    const { uid, role } = socket.data;
    if (!uid) return;

    if (role === 'embed') {
      // Embed → broadcast to ALL Apps in the room
      socket.to(uid).emit('syncit', data);
    } else {
      // App → send ONLY to the Embed socket (not to other Apps)
      const embedSocketId = embedSockets.get(uid);
      if (embedSocketId) {
        io.to(embedSocketId).emit('syncit', data);
      }
    }
  });

  socket.on('disconnect', (reason) => {
    const { uid, role } = socket.data;
    if (role === 'embed' && uid) {
      embedSockets.delete(uid);
    }
    console.log(`[disconnect] ${socket.id} (${reason})`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Syncit Socket.IO relay server listening on port ${PORT}`);
});
