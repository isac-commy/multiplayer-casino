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

function renderCards(cards){return (cards||[]).map(c=>c.hidden?'<span class="playing-card back">♠</span>':`<span class="playing-card ${['♥','♦'].includes(c.s)?'red':''}">${escapeHtml(c.r)}${c.s}</span>`).join('');}
function gameButton(label,action,primary=false){return `<button data-action="${action}" class="${primary?'primary':''}">${label}</button>`;}
$('startGame').addEventListener('click',()=>{ $('gameError').textContent=''; socket.emit('game:start'); });
$('gameActions').addEventListener('click',e=>{const b=e.target.closest('button[data-action]');if(!b)return;const action=b.dataset.action;if(currentGame?.type==='blackjack')socket.emit('blackjack:act',{action});else if(currentGame?.type==='poker')socket.emit('poker:act',{action,amount:currentGame.currentBet+200});});
let currentGame=null;
function renderGame(g){currentGame=g;$('gameArea').classList.remove('hidden');$('gameError').textContent='';$('startGame').textContent=g.status==='playing'?'Round in progress':'Start another round';$('startGame').disabled=g.status==='playing';$('gameStatus').textContent=g.type==='poker'?`TEXAS HOLD’EM · ${g.stage.toUpperCase()}`:'BLACKJACK · ARIA THE DEALER';$('gameDetails').textContent=g.type==='poker'?`Pot: ${g.pot} chips · Current bet: ${g.currentBet}`:`${g.status==='playing'?'Dealer is playing':'Round complete'}`;
 let html='';
 if(g.type==='poker'){
  html+=`<div><div class="board-label">Community cards</div><div class="cards-row">${renderCards(g.community)}</div></div>`;
  for(const [id,p] of Object.entries(g.players)){html+=`<div class="hand-row"><span>${escapeHtml(p.name)}${id===myId?' (you)':''}${p.folded?' · folded':''}${p.result?' · '+escapeHtml(p.result):''}</span><span class="cards-row">${renderCards(p.cards)}</span><strong>${p.bet} bet</strong></div>`;}
  $('gameActions').innerHTML=g.status==='playing'?gameButton('Fold','fold')+gameButton('Call','call',true)+gameButton('Check','check')+gameButton('Raise +200','raise'):'';
 }else{
  html+=`<div><div class="board-label">Aria · Dealer · ${g.dealerTotal} points</div><div class="cards-row">${renderCards(g.dealer)}</div></div>`;
  const p=g.players[myId];if(p){html+=`<div><div class="board-label">Your hand · ${p.total} points · Bet ${p.bet}</div><div class="cards-row">${renderCards(p.cards)}</div><div class="board-label">${p.result?escapeHtml(p.result):p.done?'Standing':'Your turn'}</div></div>`;}
  html+=`<div class="hand-row"><span>Other players</span><strong>${Object.entries(g.players).filter(([id])=>id!==myId).map(([,p])=>escapeHtml(p.name)+': '+p.total).join(' · ')||'Just you'}</strong></div>`;
  $('gameActions').innerHTML=g.status==='playing'&&p&&!p.done?gameButton('Hit','hit',true)+gameButton('Stand','stand'):'';
 }
 $('gameBoard').innerHTML=html||'<p class="muted">Waiting for players…</p>';$('gameActions').classList.toggle('hidden',!$('gameActions').innerHTML);
}
socket.on('game:state',renderGame);
socket.on('game:error',message=>{$('gameError').textContent=message;});
