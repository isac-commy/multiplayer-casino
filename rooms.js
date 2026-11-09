function makeRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, 'X');
}
function createRoom(code) {
  return { code, game: 'poker', players: new Map(), createdAt: Date.now() };
}
function joinRoom(room, id, name, chips) {
  room.players.set(id, { id, name, chips });
}
function getPublicRoom(room) {
  return {
    code: room.code,
    game: room.game,
    players: [...room.players.values()].map(({ id, name, chips }) => ({ id, name, chips }))
  };
}
module.exports = { makeRoomCode, createRoom, joinRoom, getPublicRoom };
