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
  currentGame = null; $('gameBoard').innerHTML = `<p class="muted">${room.game==='poker'?'Texas Hold’em table selected. Start when at least two friends are ready.':room.game==='blackjack'?'Blackjack selected. Play against Aria, even on your own.':room.game==='baccarat'?'Baccarat selected. Choose a chip and bet Player, Banker or Tie.':room.game==='roulette'?'Roulette selected. Choose a chip, then drag it onto a betting spot.':'Slots selected. Choose your stake and spin.'}</p>`; $('gameStatus').textContent = `${room.game.toUpperCase()} SELECTED`; $('gameDetails').textContent = 'Your table is ready. Choose your chips and start when you are ready.'; $('startGame').textContent = room.game==='poker'?'Start poker hand':room.game==='blackjack'?'Deal blackjack':'Open table'; $('startGame').disabled = false; $('gameActions').classList.add('hidden'); $('gameError').textContent='';
}
function updateTable(game) {
  const names = { poker: 'TEXAS HOLD’EM', blackjack: 'BLACKJACK TABLE', baccarat: 'BACCARAT TABLE', roulette: 'ROULETTE WHEEL', slots: 'SLOT LOUNGE' };
  const hints = { poker: 'Texas Hold’em · Friends at the table', blackjack: 'Blackjack · Beat the AI dealer', baccarat: 'Player · Banker · Tie', roulette: 'Drag chips onto the betting layout', slots: 'Slots · Spin the reels and win virtual chips' };
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
$('gameActions').addEventListener('click',e=>{const b=e.target.closest('button[data-action]');if(!b)return;const action=b.dataset.action;if(currentGame?.type==='blackjack')socket.emit('blackjack:act',{action});else if(currentGame?.type==='poker')socket.emit('poker:act',{action,amount:currentGame.currentBet+200});else if(currentGame?.type==='roulette'&&action==='spin')socket.emit('roulette:spin');else if(currentGame?.type==='roulette'&&action==='again')socket.emit('game:start');else if(currentGame?.type==='baccarat'&&action==='deal')socket.emit('baccarat:deal');else if(currentGame?.type==='baccarat'&&action==='again')socket.emit('game:start');else if(currentGame?.type==='slots'&&action.startsWith('spin'))socket.emit('slots:spin',{amount:action==='spin500'?500:100});});
let currentGame=null;
let selectedChip = 100;
function chipPicker(){return `<div class="chip-picker"><span class="board-label">DRAG A CHIP TO PLACE YOUR BET</span>${[100,250,500,1000].map(n=>`<button class="bet-chip ${selectedChip===n?'chosen':''}" draggable="true" data-chip="${n}">◆ ${n}</button>`).join('')}</div>`;}
function betSpot(label,spot){return `<button class="bet-spot" data-spot="${spot}">${label}</button>`;}
function wireBetBoard(){document.querySelectorAll('[data-chip]').forEach(b=>{b.addEventListener('click',()=>{selectedChip=Number(b.dataset.chip);renderGame(currentGame);});b.addEventListener('dragstart',e=>e.dataTransfer.setData('text/plain',b.dataset.chip));});document.querySelectorAll('[data-spot]').forEach(b=>{b.addEventListener('dragover',e=>e.preventDefault());b.addEventListener('drop',e=>{e.preventDefault();const n=Number(e.dataTransfer.getData('text/plain'))||selectedChip;placeBet(b.dataset.spot,n);});b.addEventListener('click',()=>placeBet(b.dataset.spot,selectedChip));});}
function placeBet(spot,amount){if(currentGame?.type==='roulette')socket.emit('roulette:bet',{spot,amount});if(currentGame?.type==='baccarat')socket.emit('baccarat:bet',{side:spot,amount});}
function renderGame(g){currentGame=g;$('gameArea').classList.remove('hidden');$('gameError').textContent='';$('startGame').textContent=g.status==='playing'?'In progress':g.status==='finished'?'Play again':'Deal / Open table';$('startGame').disabled=g.status==='playing';$('gameStatus').textContent=g.type==='poker'?`TEXAS HOLD’EM · ${g.stage.toUpperCase()}`:g.type.toUpperCase();$('gameDetails').textContent=g.type==='poker'?`Pot: ${g.pot} chips · Current bet: ${g.currentBet}`:g.status==='betting'?'Place your virtual-chip bets below.': 'Round complete';let html='';
 if(g.type==='poker'){html+=`<div><div class="board-label">Community cards</div><div class="cards-row">${renderCards(g.community)}</div></div>`;for(const [id,p] of Object.entries(g.players)){html+=`<div class="hand-row"><span>${escapeHtml(p.name)}${id===myId?' (you)':''}${p.folded?' · folded':''}${p.result?' · '+escapeHtml(p.result):''}</span><span class="cards-row">${renderCards(p.cards)}</span><strong>${p.bet} bet</strong></div>`;}$('gameActions').innerHTML=g.status==='playing'?gameButton('Fold','fold')+gameButton('Call','call',true)+gameButton('Check','check')+gameButton('Raise +200','raise'):'';}
 else if(g.type==='blackjack'){html+=`<div><div class="board-label">Aria · Dealer · ${g.dealerTotal} points</div><div class="cards-row">${renderCards(g.dealer)}</div></div>`;const p=g.players[myId];if(p){html+=`<div><div class="board-label">Your hand · ${p.total} points · Bet ${p.bet}</div><div class="cards-row">${renderCards(p.cards)}</div><div class="board-label">${p.result?escapeHtml(p.result):p.done?'Standing':'Your turn'}</div></div>`;}$('gameActions').innerHTML=g.status==='playing'&&p&&!p.done?gameButton('Hit','hit',true)+gameButton('Stand','stand'):'';}
 else if(g.type==='roulette'){html+=chipPicker()+`<div class="roulette-layout"><div class="roulette-number-grid">${Array.from({length:37},(_,n)=>`<button class="roulette-number ${n===0?'green':RED_NUMBERS_CLIENT.has(n)?'red':'black'}" data-spot="${n}">${n}</button>`).join('')}</div><div class="bet-spots">${['red','black','odd','even','low','high'].map(x=>betSpot(x.toUpperCase(),x)).join('')}</div></div>`;if(g.result)html+=`<h3>Wheel landed on ${g.result.number} · ${g.result.color.toUpperCase()}</h3>`;$('gameActions').innerHTML=g.status==='betting'?gameButton('SPIN THE WHEEL','spin',true):gameButton('New betting round','again',true);}
 else if(g.type==='baccarat'){html+=chipPicker()+`<div class="bet-spots baccarat-spots">${betSpot('PLAYER','player')}${betSpot('BANKER','banker')}${betSpot('TIE','tie')}</div>`;if(g.result)html+=`<div class="baccarat-result"><b>${g.result.winner.toUpperCase()} WINS</b><p>Player ${g.result.pt} · Banker ${g.result.bt}</p><div class="cards-row">Player ${renderCards(g.result.player)}</div><div class="cards-row">Banker ${renderCards(g.result.banker)}</div></div>`;$('gameActions').innerHTML=g.status==='betting'?gameButton('DEAL CARDS','deal',true):gameButton('New baccarat round','again',true);}
 else if(g.type==='slots'){html+=chipPicker()+`<div class="slot-reels">${g.result?g.result.reels.join('　'):'🍒　🔔　💎'}</div>`;if(g.result)html+=`<p>${g.result.win?'You won '+g.result.win+' chips!':'No win this spin.'}</p>`;$('gameActions').innerHTML=gameButton('SPIN 100','spin100',true)+gameButton('SPIN 500','spin500');}
 $('gameBoard').innerHTML=html||'<p class="muted">Waiting for players…</p>';$('gameActions').classList.toggle('hidden',!$('gameActions').innerHTML);wireBetBoard();}
const RED_NUMBERS_CLIENT=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
socket.on('game:state',renderGame);
socket.on('game:error',message=>{$('gameError').textContent=message;});
