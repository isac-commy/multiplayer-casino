const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { makeRoomCode, createRoom, joinRoom, leaveRoom, getPublicRoom } = require('./rooms');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } });

app.use(express.static(path.join(__dirname, '..', 'client')));
app.get('/health', (_req, res) => res.json({ ok: true }));

const rooms = new Map();
const STARTING_CHIPS = 10000;

function cleanName(value) {
  return String(value || 'Player').replace(/[<>]/g, '').trim().slice(0, 18) || 'Player';
}
function emitRoom(code) {
  const room = rooms.get(code);
  if (room) io.to(code).emit('room:update', getPublicRoom(room));
}
function sendChat(socket, room, scope, message) {
  const text = String(message || '').trim().slice(0, 240);
  if (!text) return;
  io.to(room.code).emit('chat:message', {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: room.players.get(socket.id)?.name || 'Player',
    text, scope, time: new Date().toISOString()
  });
}

io.on('connection', (socket) => {
  socket.on('room:create', ({ name } = {}, callback = () => {}) => {
    const playerName = cleanName(name);
    let code;
    do { code = makeRoomCode(); } while (rooms.has(code));
    const room = createRoom(code);
    rooms.set(code, room);
    joinRoom(room, socket.id, playerName, STARTING_CHIPS);
    socket.join(code);
    socket.data.roomCode = code;
    callback({ ok: true, room: getPublicRoom(room), playerId: socket.id });
    emitRoom(code);
  });

  socket.on('room:join', ({ code, name } = {}, callback = () => {}) => {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    const room = rooms.get(code);
    if (!room) return callback({ ok: false, error: 'Room not found. Check the code.' });
    if (room.players.size >= 8) return callback({ ok: false, error: 'That room is full (8 players).' });
    if (socket.data.roomCode) leaveCurrent(socket);
    joinRoom(room, socket.id, cleanName(name), STARTING_CHIPS);
    socket.join(code);
    socket.data.roomCode = code;
    callback({ ok: true, room: getPublicRoom(room), playerId: socket.id });
    emitRoom(code);
  });

  socket.on('chat:send', ({ message } = {}) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room) return;
    sendChat(socket, room, 'room', message);
  });

  socket.on('game:select', ({ game } = {}) => {
    const allowed = ['poker', 'blackjack', 'baccarat', 'slots'];
    const room = rooms.get(socket.data.roomCode);
    if (!room || !allowed.includes(game)) return;
    room.game = game;
    emitRoom(room.code);
    io.to(room.code).emit('system:message', `${room.players.get(socket.id)?.name || 'A player'} selected ${game}.`);
  });

  socket.on('disconnect', () => leaveCurrent(socket));
  function leaveCurrent(s) {
    const code = s.data.roomCode;
    const room = rooms.get(code);
    if (!room) return;
    const player = room.players.get(s.id);
    room.players.delete(s.id);
    s.leave(code);
    delete s.data.roomCode;
    if (room.players.size === 0) rooms.delete(code);
    else {
      io.to(code).emit('system:message', `${player?.name || 'A player'} left the room.`);
      emitRoom(code);
    }
  }
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`Casino server listening on ${port}`));
