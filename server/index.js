const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { makeRoomCode, createRoom, joinRoom, leaveRoom, getPublicRoom } = require('./rooms');
const games = require('./games');

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
  if (room) { io.to(code).emit('room:update', getPublicRoom(room)); emitGame(code); }
}
function emitGame(code) {
  const room = rooms.get(code); if (!room?.gameState) return;
  for (const id of room.players.keys()) {
    const state = room.gameState.type === 'blackjack' ? games.publicBJ(room.gameState) : room.gameState.type === 'poker' ? games.publicPoker(room.gameState, id) : games.publicExtra(room.gameState, id);
    io.to(id).emit('game:state', state);
  }
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
    const allowed = ['poker', 'blackjack', 'baccarat', 'roulette', 'slots'];
    const room = rooms.get(socket.data.roomCode);
    if (!room || !allowed.includes(game)) return;
    room.game = game; room.gameState = null;
    emitRoom(room.code);
    io.to(room.code).emit('system:message', `${room.players.get(socket.id)?.name || 'A player'} selected ${game}.`);
  });


  socket.on('game:start', () => {
    const room = rooms.get(socket.data.roomCode); if (!room) return;
    const starters = { poker: games.startPoker, blackjack: games.startBlackjack, baccarat: games.startBaccarat, roulette: games.startRoulette, slots: games.startSlots };
    const start = starters[room.game]; if (!start) return socket.emit('game:error','Choose a game first.');
    const result = start(room);
    if (!result.ok) return socket.emit('game:error', result.error);
    emitRoom(room.code);
  });
  socket.on('baccarat:bet', ({side,amount}={}) => { const room=rooms.get(socket.data.roomCode); if(!room)return; const r=games.baccaratBet(room,socket.id,side,amount); if(!r.ok)socket.emit('game:error',r.error); else emitRoom(room.code); });
  socket.on('baccarat:deal', () => { const room=rooms.get(socket.data.roomCode); if(!room)return; const r=games.baccaratDeal(room); if(!r.ok)socket.emit('game:error',r.error); else emitRoom(room.code); });
  socket.on('roulette:bet', ({spot,amount}={}) => { const room=rooms.get(socket.data.roomCode); if(!room)return; const r=games.rouletteBet(room,socket.id,spot,amount); if(!r.ok)socket.emit('game:error',r.error); else emitRoom(room.code); });
  socket.on('roulette:spin', () => { const room=rooms.get(socket.data.roomCode); if(!room)return; const r=games.rouletteSpin(room); if(!r.ok)socket.emit('game:error',r.error); else emitRoom(room.code); });
  socket.on('slots:spin', ({amount}={}) => { const room=rooms.get(socket.data.roomCode); if(!room)return; const r=games.spinSlots(room,socket.id,amount); if(!r.ok)socket.emit('game:error',r.error); else emitRoom(room.code); });

  socket.on('blackjack:act', ({ action } = {}) => {
    const room = rooms.get(socket.data.roomCode); if (!room) return;
    const result = games.actBlackjack(room, socket.id, action);
    if (!result.ok) socket.emit('game:error', result.error); else emitRoom(room.code);
  });
  socket.on('poker:act', ({ action, amount } = {}) => {
    const room = rooms.get(socket.data.roomCode); if (!room) return;
    const result = games.pokerAct(room, socket.id, action, amount);
    if (!result.ok) socket.emit('game:error', result.error); else emitRoom(room.code);
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
