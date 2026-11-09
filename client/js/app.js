const socket = io();
const $ = (id) => document.getElementById(id);
let currentRoom = null;
let myId = null;

function showError(message) { $('entryError').textContent = message || ''; }
function enterRoom(result) {
  if (!result?.ok) return showError(result?.error || 'Could not join room.');
  currentRoom = result.room;
  myId = result.playerId;
  $('entry').classList.add('hidden');
  $('lobby').classList.remove('hidden');
  $('roomCodeDisplay').textContent = currentRoom.code;
  renderRoom(currentRoom);
  $('messages').innerHTML = '<div class="system-msg">You joined the room. Say hello!</div>';
}
function playerName() { return $('playerName').value.trim() || 'Player'; }

$('createBtn').addEventListener('click', () => {
  showError('');
  socket.emit('room:create', { name: playerName() }, enterRoom);
});
$('joinBtn').addEventListener('click', () => {
  showError('');
  socket.emit('room:join', { name: playerName(), code: $('roomCode').value }, enterRoom);
});
$('roomCode').addEventListener('input', e => e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
$('copyCode').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(currentRoom.code); $('copyCode').textContent = 'Copied!'; }
  catch { $('copyCode').textContent = currentRoom.code; }
});

function renderRoom(room) {
  currentRoom = room;
  $('roomCodeDisplay').textContent = room.code;
  $('playerCount').textContent = `${room.players.length}/8`;
  $('playersList').innerHTML = room.players.map(p => `
    <div class="player"><span class="player-name">${escapeHtml(p.name)}${p.id === myId ? ' (you)' : ''}</span>
    <span class="player-chips">◆ ${Number(p.chips).toLocaleString()}</span></div>`).join('');
  document.querySelectorAll('.game-card').forEach(card => card.classList.toggle('active', card.dataset.game === room.game));
  updateTable(room.game);
}
function updateTable(game) {
  const names = { poker: 'POKER TABLE', blackjack: 'BLACKJACK TABLE', baccarat: 'BACCARAT TABLE', slots: 'SLOT LOUNGE' };
  const hints = { poker: 'Texas Hold’em · Friends at the table', blackjack: 'Blackjack · Beat the AI dealer', baccarat: 'Player · Banker · Tie', slots: 'Slots · Reels and bonus rounds' };
  $('tableGameName').textContent = names[game] || 'CASINO TABLE';
  $('tableHint').textContent = hints[game] || 'Choose a game.';
}
document.querySelectorAll('.game-card').forEach(card => card.addEventListener('click', () => {
  socket.emit('game:select', { game: card.dataset.game });
}));
$('chatForm').addEventListener('submit', e => {
  e.preventDefault();
  const message = $('chatInput').value.trim();
  if (!message) return;
  socket.emit('chat:send', { message });
  $('chatInput').value = '';
});
socket.on('room:update', renderRoom);
socket.on('chat:message', msg => {
  const row = document.createElement('div');
  row.className = 'message';
  const time = new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const name = document.createElement('b'); name.textContent = msg.name;
  const body = document.createElement('span'); body.textContent = msg.text;
  const stamp = document.createElement('time'); stamp.textContent = time;
  row.append(name, body, stamp);
  $('messages').appendChild(row);
  $('messages').scrollTop = $('messages').scrollHeight;
});
socket.on('system:message', text => {
  const row = document.createElement('div'); row.className = 'system-msg'; row.textContent = text;
  $('messages').appendChild(row);
});
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
