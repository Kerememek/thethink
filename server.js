const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  socket.on('join-room', (roomId) => {
    socket.join(roomId);

    const peers = [...(io.sockets.adapter.rooms.get(roomId) || [])].filter(
      (id) => id !== socket.id
    );

    socket.emit('existing-peers', peers);
    socket.to(roomId).emit('peer-joined', socket.id);

    socket.on('signal', ({ target, payload }) => {
      io.to(target).emit('signal', { from: socket.id, payload });
    });

    socket.on('chat-message', (message) => {
      socket.to(roomId).emit('chat-message', {
        from: socket.id,
        text: message,
        at: new Date().toISOString()
      });
    });

    socket.on('disconnect', () => {
      socket.to(roomId).emit('peer-left', socket.id);
    });
  });
});

server.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});
