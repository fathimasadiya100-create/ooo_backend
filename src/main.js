import './style.css';
import { createGameSocket } from './game-socket.js';

const socket = createGameSocket();
const app = document.querySelector('#app');

const sound = {
  muted: localStorage.getItem('ooo-muted') === 'true',
  ctx: null,

  play(type = 'click') {
    if (this.muted) return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      this.ctx ||= new AudioContext();
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const ctx = this.ctx;
      const now = ctx.currentTime;
      const notes = {
        click: [520, 0.055],
        correct: [880, 0.16],
        win: [660, 0.12]
      };
      const [frequency, duration] = notes[type] || notes.click;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(frequency, now);
      if (type === 'correct' || type === 'win') {
        oscillator.frequency.exponentialRampToValueAtTime(
          frequency * 1.35, now + duration
        );
      }

      gain.gain.setValueAtTime(0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now);
      oscillator.stop(now + duration);
    } catch (error) {
      console.warn('Sound effect unavailable:', error);
    }
  },

  toggle() {
    this.muted = !this.muted;
    localStorage.setItem('ooo-muted', String(this.muted));
    render();
  }
};

const avatars = ['pixel-fox','pixel-frog','pixel-cat','pixel-bunny','pixel-bear','pixel-axolotl','pixel-star','pixel-mochi'];
const savedAvatar=localStorage.getItem('ooo-avatar');
const state = { screen:'home', name:localStorage.getItem('ooo-name')||'', room:null, notice:'', isPublic:false, myReady:false, mySmoothie:null, fruits:[], avatar:avatars.includes(savedAvatar)?savedAvatar:'pixel-fox', selectedMode:localStorage.getItem('ooo-mode')||'smoothie-showdown', selectedGames:['smoothie-showdown'], privateGame:null, sudokuState:null, dotPath:[], dotMessage:'', dotRoundId:null, drawingStrokes:[], drawingRoundId:null, pen:'#2a223b', brushWidth:4, erasing:false, raceX:0, raceY:0, raceJump:false };
const $ = (s) => document.querySelector(s);
const esc = (s='') => String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const me = () => state.room?.players.find(p=>p.id===socket.id);
const host = () => !!me()?.isHost;
const fruit = (id) => state.fruits.find(f=>f.id===id) || {id,name:id,emoji:'',cost:0};
function fruitSprite(id, cls='fruit-pixel') { const data={strawberry:['#ff6e91','#b92f61','#5c9c63','M8 5h4v2h3v4h-2v4h-3v2H8v-2H5v-4H3V7h3V5z'],banana:['#ffe17b','#c99236','#7aa85c','M4 4h4v5h2v3h4v-2h3v4h-3v3h-5v-2H6v-3H4z'],blueberry:['#739dff','#3e59ae','#5c9c63','M4 5h4v2h3V5h4v4h2v5h-3v3H6v-3H3V8h1z'],mango:['#ffad58','#e36b48','#5c9c63','M8 3h4v3h3v4h-2v5h-4v2H6v-3H4V9h2V6h2z'],kiwi:['#b9db65','#628e45','#f5e6a1','M8 3h4v2h3v3h2v5h-3v3H6v-3H3V8h3V5h2z'],pineapple:['#ffd166','#c58d35','#5c9c63','M8 1h3v4h3v2h-2v2h-4V7H5V5h3z M6 8h8v8h-2v2H8v-2H6z']}; const d=data[id]||data.strawberry; return `<svg class="${cls}" viewBox="0 0 20 20" shape-rendering="crispEdges" aria-hidden="true"><path d="${d[3]}" fill="${d[0]}"/><path d="M7 7h2v2H7z M11 11h2v2h-2z" fill="${d[1]}"/><path d="M8 3h4v2H8z M10 1h2v2h-2z" fill="${d[2]}"/></svg>`; }
const avatarColors={ 'pixel-fox':['#f6a34b','#fff0cc','#4b2b3a'], 'pixel-frog':['#79dca0','#d7ffb5','#264b55'], 'pixel-cat':['#d5b3ff','#fff0fa','#59436f'], 'pixel-bunny':['#ffb5ce','#fff0f4','#78435e'], 'pixel-bear':['#c88f6a','#ffe1b9','#5a3b36'], 'pixel-axolotl':['#8ee3e9','#e8ffff','#356578'], 'pixel-star':['#ffe07a','#fff5bd','#7a553d'], 'pixel-mochi':['#b6e7c5','#f8ffdc','#52705a'] };
function avatarMarkup(id, cls='pixel-avatar'){const c=avatarColors[id]||avatarColors['pixel-fox'];const patterns={
'pixel-fox':['00011000','00122100','01222210','12222221','12211221','12222221','01200210','00100100'],
'pixel-frog':['00111100','01222210','12222221','12222221','12211221','12222221','01222210','00111100'],
'pixel-cat':['10000001','11000011','12222221','12222221','12211221','12222221','01222210','00100100'],
'pixel-bunny':['01000010','01200120','01222220','01222220','12211221','12222221','01222210','00111100'],
'pixel-bear':['00111100','01222210','12222221','12222221','12211221','12222221','01222210','00111100'],
'pixel-axolotl':['01011010','01222210','12222221','12222221','12211221','12222221','01222210','00111100'],
'pixel-star':['00011000','00122100','01222210','12222221','12222221','01222210','00122100','00011000'],
'pixel-mochi':['00111100','01222210','12222221','12222221','12211221','12222221','01222210','00111100']};const pat=patterns[id]||patterns['pixel-fox'];let rects='';pat.forEach((row,y)=>[...row].forEach((v,x)=>{if(v!=='0'){const fill=v==='1'?c[0]:v==='2'?c[1]:c[2];rects+=`<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>`;}}));return `<svg class="${cls}" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true"><rect width="8" height="8" fill="#302944"/>${rects}<rect x="2" y="3" width="1" height="1" fill="#30213a"/><rect x="5" y="3" width="1" height="1" fill="#30213a"/><rect x="3" y="5" width="2" height="1" fill="#c86d8a"/></svg>`;}
const modeInfo={ 'smoothie-showdown':{emoji:'<svg viewBox="0 0 32 32" shape-rendering="crispEdges"><path fill="#ff91b5" d="M7 7h18l-3 19H10z"/><path fill="#fff0dc" d="M10 10h12l-2 13h-8z"/><path fill="#ffd166" d="M12 14h8v6h-8z"/><path stroke="#fff0dc" stroke-width="3" d="M18 3l4 7"/></svg>',name:'Smoothie Showdown',sub:'Skill & profit',desc:'Build the right recipe, serve fast, and beat everyone on net profit.',rules: [
  'Check customer fruit requests and quantities.',
  'Add fruits to your blender, then blend and serve.',
  'Earn sales and tips while paying fruit costs.'
],cls:'peach'},'dot-to-domination':{emoji:'<svg viewBox="0 0 32 32" shape-rendering="crispEdges"><path fill="#8de0c2" d="M4 4h24v24H4z"/><path stroke="#35283f" stroke-width="2" d="M10 4v24 M16 4v24 M22 4v24 M4 10h24 M4 16h24 M4 22h24"/><path fill="#ff91b5" d="M7 7h5v5H7z M19 13h5v5h-5z"/><path fill="#ffd166" d="M19 19h5v5h-5z"/></svg>',name:'Dot to Domination',sub:'Logic & speed',desc:'Connect numbered checkpoints in order. Beat the clock and rule the grid.',rules: [
  'Connect checkpoints in ascending numerical order.',
  'Move up, down, left, or right without revisiting cells.',
  'Submit a valid continuous path.'
],cls:'mint'},'drawn-to-chaos':{emoji:'<svg viewBox="0 0 32 32" shape-rendering="crispEdges"><path fill="#8de0c2" d="M5 5h22v22H5z"/><path fill="#35283f" d="M9 9h4v4H9z M17 9h6v3h-6z M10 18h3v5h-3z M17 17h7v3h-7z"/></svg>',name:'Drawn to Chaos',sub:'Creativity & guessing',desc:'Draw a ridiculous prompt while friends race to guess.',rules: [
  'Draw the selected prompt on the canvas.',
  'Other players type guesses into the live feed.',
  'Correct guesses earn points.'
],cls:'mint'},'sudoku-knockout':{emoji:'<svg viewBox="0 0 32 32" shape-rendering="crispEdges"><path fill="#8de0c2" d="M4 4h24v24H4z"/><path stroke="#35283f" stroke-width="2" d="M12 4v24 M20 4v24 M4 12h24 M4 20h24"/><path fill="#35283f" d="M7 7h3v3H7z M15 15h3v3h-3z M23 23h3v3h-3z"/></svg>',name:'Sudoku Knockout',sub:'Logic & speed',desc:'Race your friends to complete the same Sudoku grid.',rules: [
  'Solve the Sudoku puzzle.',
  'Fill empty cells with numbers from 1 to 9.',
  'Follow standard Sudoku rules.'
],cls:'mint'}};

function modeCards() {
  return `<section class="arcade-pick">
    <div class="section-heading">
      <span class="eyebrow">THE ARCADE</span>
      <h2>MINI-GAMES <span class="pink">IN THE PARTY.</span></h2>
      <p>Four games to play with your friends.</p>
    </div>
    <div class="arcade-grid">
      ${Object.entries(modeInfo).map(([id, m], i) => `
        <article class="arcade-card ${m.cls}">
          <span class="arcade-emoji">${m.emoji}</span>
          <small>0${i + 1} / ${m.sub.toUpperCase()}</small>
          <h3>${m.name}</h3>
          <p>${m.desc}</p>
          <details class="card-rules">
            <summary class="rules-toggle"> HOW TO PLAY</summary>
            <ul>${(m.rules || []).map(r => `<li>${esc(r)}</li>`).join('')}</ul>
          </details>
        </article>
      `).join('')}
    </div>
  </section>`;
}
function render(){
  const active=document.activeElement; const preserveGuess=active?.id==='draw-guess-input'; const guessValue=preserveGuess?active.value:''; const guessStart=preserveGuess?active.selectionStart:null; const guessEnd=preserveGuess?active.selectionEnd:null;
  const content = state.screen==='home' ? home() : state.screen==='lobby' ? lobby() : state.screen==='game' ? game() : finished();
  app.innerHTML = `<div class="pixel-sky"><span>✦</span><span>·</span><span>✧</span><span>✦</span><span>·</span><span>✧</span><span>✦</span></div><header class="topbar"><a class="brand" href="#" data-action="home"><span class="brand-icon">OO</span><span>ODD ONE <i>OUT</i></span></a>
  
<div class="top-status">
<button class="soft-button" data-action="toggle-sound" aria-label="Toggle sound">
  ${sound.muted ? 'SOUND OFF' : 'SOUND ON'}
</button>
<span class="live-dot"></span>
${socket.connected ? 'SERVER ONLINE' : 'CONNECTING...'}
</div>

  </header>${content}<footer>PIXEL PEOPLE. QUESTIONABLE DECISIONS. <span>✦</span> SMOOTHIE SHOWDOWN</footer>${state.notice?`<div class="toast" role="status">${esc(state.notice)}<button data-action="dismiss">×</button></div>`:''}`;
  bind();
  if(preserveGuess){const input=$('#draw-guess-input');if(input){input.value=guessValue;input.focus();if(guessStart!==null&&guessEnd!==null)input.setSelectionRange(guessStart,guessEnd);}}
}
function home(){return `<main class="home-page"><div class="hero-copy"><div class="eyebrow"><span class="tiny-star">✦</span> A LITTLE PARTY GAME FOR YOUR PEOPLE</div><h1 class="brand-hero-title">ODD ONE<br><span class="pink">OUT.</span></h1><div class="hero-tagline">TINY GAMES. BIG CHAOS.</div><p class="lead">Four mini-games. Four ways to cause chaos. Bring your friends and find your main character energy.</p><div class="hero-sprinkles" aria-label="Animated pixel fruit"><span class="sprite sprite-a">${fruitSprite('strawberry','hero-fruit')}</span><span class="sprite sprite-b">${fruitSprite('banana','hero-fruit')}</span><span class="sprite sprite-c">${fruitSprite('mango','hero-fruit')}</span><span class="sprite sprite-d">${fruitSprite('blueberry','hero-fruit')}</span><span class="sprite sprite-e">${fruitSprite('kiwi','hero-fruit')}</span></div><div class="feature-strip"><span>▣ 2–8 PLAYERS</span><span>✦ LIVE MULTIPLAYER</span><span>♥ FOUR GAMES. ONE SQUAD.</span></div></div><section class="join-card"><div class="card-top"><span class="pixel-label">PLAYER SETUP</span><span class="card-spark">✦</span></div><label for="display-name">YOUR DISPLAY NAME</label><input id="display-name" maxlength="16" placeholder="e.g. Toast Goblin" value="${esc(state.name)}" autocomplete="nickname"><div class="section-mini-title">PICK YOUR LITTLE GUY</div><div class="avatar-picker">${avatars.map(a=>`<button class="avatar-choice ${state.avatar===a?'selected':''}" data-avatar="${a}" aria-label="Choose avatar ${a}">${avatarMarkup(a,'avatar-sprite')}</button>`).join('')}</div><div class="selected-mode-note">PLAYING: <b>${state.selectedGames.length} game${state.selectedGames.length===1?'':'s'} in party set</b></div><button class="big-button" data-action="create">✦ CREATE A ROOM <span>→</span></button><div class="or-divider"><span></span> OR JOIN YOUR FRIEND <span></span></div><div class="join-row"><input id="join-code" maxlength="4" placeholder="ROOM CODE" aria-label="Room code"><button class="join-button" data-action="join">JOIN ↗</button></div><p class="fine-print">Invite 2–8 friends to join your room. Keep this page open while playing.</p></section><div class="decor-badge badge-left">FRUIT<br>POWER <span>♡</span></div><div class="decor-badge badge-right">BLEND<br>IT UP <span>✦</span></div></main>${modeCards()}`}
function playerCards(){return (state.room?.players||[]).map(p=>`<div class="player-card ${p.id===socket.id?'is-me':''}"><div class="player-avatar" style="--avatar-color:${p.color}">${avatarMarkup(p.avatar,'player-sprite')}<span class="player-status ${p.ready?'ready':''}"></span></div><b>${esc(p.name)}</b><small>${p.isHost?'✦ HOST':p.id===socket.id?'YOU':p.ready?'READY!':'JOINED'}</small></div>`).join('')}
function lobby(){return `<main class="page-wrap"><div class="eyebrow">✦ OPEN YOUR STALLS ✦</div><h1 class="page-title">YOUR SQUAD <span class="pink">IS HERE.</span></h1><p class="lead center">Share this room code. Party set: <b>${(state.room?.playlist||[state.room?.mode]).map(id=>modeInfo[id]?.name||id).join(' → ')}</b>. Invite 2–8 friends to join your room.</p><section class="room-banner"><div><small>YOUR ROOM CODE</small><strong>${esc(state.room?.code||'----')}</strong></div><button class="copy-code" data-action="copy">▣ COPY CODE</button></section><div class="lobby-heading"><h2>THE STALLS <span>(${state.room?.players.length||0}/8)</span></h2><span class="waiting"><i></i> WAITING FOR PLAYERS</span></div><div class="player-grid">${playerCards()}${Array.from({length:Math.max(0,8-(state.room?.players.length||0))},()=>`<div class="empty-slot"><span>＋</span><small>EMPTY STALL</small></div>`).join('')}</div>${host()?`<section class="lobby-lineup"><h2>HOST: BUILD YOUR PARTY SET</h2><p>Choose one to four games. Everyone stays in this room between games.</p><div class="lineup-options">${Object.entries(modeInfo).map(([id,m])=>`<button class="lineup-chip ${(state.room?.playlist||[]).includes(id)?'selected':''}" data-session-game="${id}">${m.name} ${(state.room?.playlist||[]).includes(id)?'✓':''}</button>`).join('')}</div><small>${(state.room?.playlist||[]).length} / 4 GAMES SELECTED</small></section>`:''}<div class="lobby-actions">${!host()?`<button class="big-button" data-action="ready">${state.myReady?'✓ YOU ARE READY':'I’M READY!'}</button>`:`<button class="big-button" data-action="start" ${((state.room?.players.length||0)<2 || !(state.room?.playlist||[]).length)?'disabled':''}>START PARTY <span>→</span></button>`}<button class="soft-button" data-action="leave">LEAVE ROOM</button></div><p class="fine-print center">You need at least 2 players. Eight players maximum. Keep this page open while playing.</p></main>`}
function orderCard(s){const order=s?.order;if(!order)return '<div class="order-card">Your next customer is on the way…</div>';const target=Object.entries(order.target).map(([id,count])=>`${fruitSprite(id)} <span>${fruit(id).name} ×${count}</span>`).join('　');return `<div class="order-card"><div class="customer-bubble">${avatarMarkup(({Pip:'pixel-frog',Mochi:'pixel-bear',Bibi:'pixel-bunny',Toast:'pixel-fox',Peaches:'pixel-cat',Kiwi:'pixel-mochi'})[order.customer.name]||'pixel-frog','customer-sprite')}</div><div class="order-copy"><small>CUSTOMER ${esc(order.customer.name.toUpperCase())} WANTS</small><h2>${esc(order.title)}</h2><p>${target}</p><span class="order-hint">Match the fruit and amounts for a top rating!</span><div class="patience-track"><i id="patience-fill"></i></div></div><div class="order-pay">BASE<br><b>${order.basePay} <span class="coin-pixel" aria-label="coins"></span></b></div></div>`}

function game() {
  const r = state.room;

  if (r?.mode === 'sudoku-knockout') return sudokuGame();
  if (r?.mode === 'dot-to-domination') return dotGame();
  if (r?.mode === 'drawn-to-chaos') return drawingGame();

  const s = state.mySmoothie;
  const players = [...(r?.players || [])].sort((a, b) => b.profit - a.profit);
  const bowl = s?.bowl || [];

  const bowlMarkup = bowl.map((id, i) =>
    `<button class="bowl-fruit" data-remove="${i}" title="Remove ${esc(fruit(id).name)} (cost won't be refunded)">${fruitSprite(id)}<small>×</small></button>`
  ).join('');

  const fruitMarkup = (s?.fruits || state.fruits).map(f =>
    `<button class="fruit-button" data-fruit="${f.id}" draggable="true" title="${f.name} costs ${f.cost} coins"><span>${fruitSprite(f.id)}</span><b>${f.name}</b><small>${f.cost} <span class="coin-pixel" aria-label="coins"></span></small></button>`
  ).join('');

  const last = s?.lastResult;

  return `
    <main class="page-wrap smoothie-page">
      <div class="game-topline">
        <span class="eyebrow">SMOOTHIE SHOWDOWN</span>
        <span class="room-small">ROOM ${esc(r?.code || '')}</span>
      </div>

      <div class="stall-heading">
        <div>
          <span class="section-mini-title">YOUR LITTLE SHOP</span>
          <h1 class="page-title">THE <span class="pink">SMOOTHIE BAR.</span></h1>
        </div>
        <div class="cash-card">
          <small>YOUR NET PROFIT</small>
          <strong id="my-profit">${Math.round(s?.profit || 0)} <span class="coin-pixel" aria-label="coins"></span></strong>
          <span>${s?.served || 0} smoothies served</span>
        </div>
      </div>

      ${orderCard(s)}

      <section class="shop-counter">
        <div class="counter-scene">
          <div class="counter-window">
            <span class="pixel-cloud-shape"></span>
            <span class="pixel-cloud-shape cloud-two"></span>
            <div class="counter-shelf"></div>
          </div>

          <div class="shop-customer">
            ${avatarMarkup(
              ({
                Pip: 'pixel-frog',
                Mochi: 'pixel-bear',
                Bibi: 'pixel-bunny',
                Toast: 'pixel-fox',
                Peaches: 'pixel-cat',
                Kiwi: 'pixel-mochi'
              })[s?.order?.customer?.name] || 'pixel-frog',
              'shop-customer-sprite'
            )}
            <span class="customer-thought">${s?.order ? 'One fresh smoothie, please!' : 'Next customer coming up…'}</span>
          </div>

          <div class="counter-machine">
            <div class="machine-top"></div>
            <div class="machine-glass">
              <div class="machine-drink">
                ${(bowl.length ? bowl : ['strawberry'])
                  .slice(0, 4)
                  .map(id => fruitSprite(id, 'machine-fruit'))
                  .join('')}
              </div>
            </div>
            <div class="machine-base">
              <span class="machine-button"></span>
              <span class="machine-label">MIX-O-MATIC</span>
            </div>
          </div>

          <div class="counter-front">
            <span>ODD ONE OUT JUICE BAR</span>
            <span class="counter-tile"></span>
          </div>
        </div>

        <div class="prep-status">
          <span class="prep-dot"></span>
          ${bowl.length
            ? `READY TO BLEND · ${bowl.length} INGREDIENT${bowl.length === 1 ? '' : 'S'}`
            : 'PICK FRUIT FROM THE SHELF TO START YOUR ORDER'}
        </div>
      </section>

      <section class="blend-panel">
        <div class="panel-heading">
          <h2>YOUR MIXER STATION</h2>
          <span>${bowl.length}/8 FRUITS</span>
        </div>

        <div class="bowl-drop" id="bowl-drop">
          <div class="blender-jar">
            <div class="blender-liquid">
              ${bowl.length
                ? bowl.map(id => fruitSprite(id, 'fruit-pixel blender-fruit')).join('')
                : 'ADD FRUIT TO MIXER'}
            </div>
            <div class="blender-base">▰ BLENDER ▰</div>
          </div>

          <div class="bowl-contents">
            ${bowlMarkup || '<span class="empty-bowl">Click a fruit or drag it here.</span>'}
          </div>
        </div>

        <div class="fruit-shelf">
          <div class="shelf-label">
            PICK YOUR INGREDIENTS <span>CLICK OR DRAG</span>
          </div>
          <div class="fruit-grid">${fruitMarkup}</div>
        </div>

        <div class="blend-actions">
          <button class="soft-button" data-action="clear-bowl" ${!bowl.length ? 'disabled' : ''}>CLEAR BLENDER</button>
          <button class="big-button serve-button" data-action="serve" ${!bowl.length ? 'disabled' : ''}>BLEND + SERVE CUSTOMER!</button>
        </div>
      </section>

      ${last ? `
        <div class="last-review">
          <span class="review-face">
            ${avatarMarkup(
              last.quality >= 85 ? 'pixel-star' : last.quality >= 55 ? 'pixel-mochi' : 'pixel-bear',
              'review-sprite'
            )}
          </span>
          <div>
            <b>${last.quality >= 85 ? 'PERFECT BLEND!' : last.quality >= 55 ? 'NOT BAD!' : 'OOPS, A BIT WEIRD!'}</b>
            <p>${last.quality}% recipe match · +${last.payment} sale · +${last.tip} tip · ${last.elapsed}s</p>
          </div>
          <strong>+${last.profitChange} <span class="coin-pixel"></span></strong>
        </div>
      ` : ''}

      <div class="smoothie-clock">
        <span>TIME LEFT</span>
        <strong id="round-clock">01:30</strong>
        <div class="clock-track"><i id="clock-fill"></i></div>
      </div>

      <section class="live-stalls">
        <div class="panel-heading">
          <h2>LIVE STALL RACE</h2>
          <span>NET PROFIT</span>
        </div>

        <div class="stall-score-list">
          ${players.map((p, i) => `
            <div class="stall-score">
              <span class="stall-rank">${i === 0 ? '<span class="pixel-crown">1</span>' : i + 1}</span>
              <span class="stall-avatar" style="--avatar-color:${p.color}">
                ${avatarMarkup(p.avatar, 'stall-sprite')}
              </span>
              <span class="stall-name">
                ${esc(p.name)}${p.id === socket.id ? ' (YOU)' : ''}
                <small>${p.served} served · ${p.tips} tip coins</small>
              </span>
              <strong>${Math.round(p.profit)} <span class="coin-pixel"></span></strong>
            </div>
          `).join('')}
        </div>
      </section>

      <p class="fine-print center">
        Every fruit costs coins when added. Your profit = sales + tips − ingredient costs. Removing fruit won't refund its cost.
      </p>
    </main>
  `;
}

function sudokuGame(){const r=state.room,sd=state.sudokuState||{},puzzle=sd.puzzle||r.gameData?.puzzle||Array.from({length:9},()=>Array(9).fill(0)),grid=sd.grid||puzzle,progress=sd.progress||0;return `<main class="page-wrap mode-game sudoku-game"><div class="game-topline"><span class="eyebrow">SUDOKU KNOCKOUT</span><span class="room-small">ROOM ${esc(r.code)}</span></div><h1 class="page-title">THINK FAST. <span class="pink">FILL IT IN.</span></h1><p class="lead center">Everyone gets the same puzzle. Fill every square correctly to win. Wrong entries can be changed.</p><div class="sudoku-hud"><div><small>YOUR PROGRESS</small><strong>${progress}%</strong><div class="clock-track"><i style="width:${progress}%"></i></div></div><div><small>TIME LEFT</small><strong id="sudoku-clock">${Math.max(0,Math.ceil(((r.endsAt||Date.now())-Date.now())/1000))}s</strong></div></div><section class="sudoku-board" aria-label="Sudoku puzzle">${grid.map((row,ri)=>row.map((v,ci)=>`<button class="sudoku-cell ${puzzle[ri][ci]?'given':''} ${ci%3===2&&ci!==8?'block-right':''} ${ri%3===2&&ri!==8?'block-bottom':''}" data-sudoku-row="${ri}" data-sudoku-col="${ci}" ${puzzle[ri][ci]||sd.solved?'disabled':''}>${v||''}</button>`).join('')).join('')}</section><div class="sudoku-numbers">${[1,2,3,4,5,6,7,8,9].map(n=>`<button class="number-key" data-sudoku-value="${n}" ${sd.solved?'disabled':''}>${n}</button>`).join('')}<button class="number-key erase-key" data-sudoku-value="0">⌫</button></div><p class="fine-print center">Tap an empty square, then choose a number. The server checks the full solution.</p><section class="live-stalls"><div class="panel-heading"><h2>LIVE PUZZLE RACE</h2><span>PROGRESS</span></div>${r.players.slice().sort((a,b)=>(b.sudokuProgress||0)-(a.sudokuProgress||0)).map(p=>`<div class="stall-score">${avatarMarkup(p.avatar,'stall-sprite')}<span class="stall-name">${esc(p.name)}${p.id===socket.id?' (YOU)':''}</span><strong>${p.sudokuSolved?'SOLVED':`${p.id===socket.id?progress:(p.sudokuProgress||0)}%`}</strong></div>`).join('')}</section></main>`}
function finished(){return otherFinished();}
function dotGame(){
  const r=state.room,g=r.gameData||{},grid=g.grid||Array.from({length:5},()=>Array(5).fill(0));
  const path=state.dotRoundId===g.roundId?state.dotPath:[];
  const pathIndex=new Map(path.map((cell,i)=>[`${cell.row},${cell.col}`,i+1]));
  // Show blocked edges from the server's wall list so players can plan a valid route.
  const edgeKey=(a,b)=>[a,b].sort().join('|');
  const wallEdges=new Set((g.walls||[]).map(w=>edgeKey(`${w.a.row},${w.a.col}`,`${w.b.row},${w.b.col}`)));
  const wallClass=(ri,ci)=>[
    ri>0&&wallEdges.has(edgeKey(`${ri-1},${ci}`,`${ri},${ci}`))?'wall-top':'',
    ri<5&&wallEdges.has(edgeKey(`${ri},${ci}`,`${ri+1},${ci}`))?'wall-bottom':'',
    ci>0&&wallEdges.has(edgeKey(`${ri},${ci-1}`,`${ri},${ci}`))?'wall-left':'',
    ci<5&&wallEdges.has(edgeKey(`${ri},${ci}`,`${ri},${ci+1}`))?'wall-right':''
  ].filter(Boolean).join(' ');
  const left=Math.max(0,Math.ceil(((r.endsAt||Date.now())-Date.now())/1000));
  const cells=grid.map((row,ri)=>row.map((n,ci)=>{const idx=pathIndex.get(`${ri},${ci}`);return `<button class="dot-cell ${wallClass(ri,ci)} ${n?'checkpoint':''} ${idx?'on-path':''} ${n&&idx?'path-checkpoint':''}" data-dot-cell="${ri},${ci}" tabindex="${ri===0&&ci===0?0:-1}" ${r.phase!=='solving'||me()?.dotFinished?'disabled':''} aria-label="Row ${ri+1}, column ${ci+1}${n?`, checkpoint ${n}`:''}${wallClass(ri,ci)?', has blocked edge':''}">${idx?`<span class="dot-path-index">${idx}</span>`:''}${n?`<span class="dot-checkpoint">${n}</span>`:''}</button>`}).join('')).join('');
  const rank=new Map((g.finishOrder||[]).map((id,i)=>[id,i+1]));
  return `<main class="page-wrap mode-game dot-game"><div class="game-topline"><span class="eyebrow">DOT TO DOMINATION</span><span class="room-small">ROOM ${esc(r.code)}</span></div><h1 class="page-title">CONNECT THE DOTS. <span class="pink">RULE THE GRID.</span></h1><p class="lead center">Medium difficulty · 6×6 grid · 8 checkpoints. Connect them in ascending order using one continuous path. Move up, down, left, or right; never revisit a cell. Red edges are walls and cannot be crossed.</p>
  <div class="dot-hud"><div><small>${r.phase==='countdown'?'GET READY':'TIME LEFT'}</small><strong id="dot-clock">${r.phase==='countdown'?`STARTING ${left}`:`${String(Math.floor(left/60)).padStart(2,'0')}:${String(left%60).padStart(2,'0')}`}</strong></div><div><small>CHECKPOINT</small><strong>${path.length?Math.max(...path.map(c=>grid[c.row][c.col]||0),1):1} / ${g.finalNumber||8}</strong></div></div>${r.phase==='countdown'?'<section class="game-panel dot-message">Puzzle starts in a moment. Everyone has the same grid.</section>':r.phase==='result'||r.status==='finished'?'<section class="game-panel dot-message">Round complete. Check the results below.</section>':`<section class="dot-board" aria-label="Dot to Domination puzzle grid">${cells}</section><p class="dot-feedback ${state.dotMessage?'has-message':''}" role="status">${esc(state.dotMessage||'Tap checkpoint 1, then build your path one adjacent cell at a time.')}</p><div class="dot-controls"><button class="soft-button" data-action="dot-undo" ${!path.length||me()?.dotFinished?'disabled':''}>UNDO LAST</button><button class="soft-button" data-action="dot-reset" ${!path.length||me()?.dotFinished?'disabled':''}>RESET PATH</button><button class="big-button" data-action="dot-submit" ${!path.length||me()?.dotFinished?'disabled':''}>SUBMIT PATH →</button></div>`}<section class="game-panel dot-opponents"><h2>LIVE RACE</h2>${r.players.slice().sort((a,b)=>(rank.get(a.id)||99)-(rank.get(b.id)||99)).map(p=>`<div class="dot-player"><span class="dot-player-rank">${rank.get(p.id)||'—'}</span>${avatarMarkup(p.avatar,'mini-sprite')}<b>${esc(p.name)}${p.id===socket.id?' (YOU)':''}</b><span>${p.dotFinished?`FINISHED · +${p.dotPoints||0}`:'SOLVING'}</span></div>`).join('')}</section><p class="fine-print center">First valid path: 100 points · Second: 75 · Third: 50 · Every later finisher: 25 · Timeout: 0.</p></main>`;
}
function drawingGame(){const r=state.room,g=r.gameData||{},priv=state.privateGame||{},artist=g.artistId===socket.id,isChoice=r.phase==='word-choice';const words=priv.wordChoices||[];const letters=(g.wordMask||'').split('').map(ch=>ch===' '?'　':ch).join(' ');return `<main class="page-wrap mode-game"><div class="game-topline"><span class="eyebrow">DRAWN TO CHAOS</span><span class="room-small">ROOM ${esc(r.code)}</span></div><h1 class="page-title">DRAW BADLY. <span class="pink">WIN BIG.</span></h1><div class="game-timer">${isChoice?'ARTIST CHOOSES A WORD':r.phase==='result'?'TURN RESULTS':`TIME LEFT · ${Math.max(0,Math.ceil(((r.endsAt||Date.now())-Date.now())/1000))}s`}</div>${r.phase==='result'&&g.lastTurnResult?`<section class="game-panel reveal-panel"><h2>THE WORD WAS: ${esc(g.lastTurnResult.word)}</h2><p>${esc(g.lastTurnResult.artistName)} drew this one.</p><p><b>Correct guessers:</b> ${(g.lastTurnResult.correctGuessers||[]).map(q=>`${esc(q.name)} (+${(g.guesses||[]).find(v=>v.playerId===q.playerId&&v.correct)?.points||0})`).join(', ')||'Nobody guessed it in time.'}</p><p>Next artist coming up…</p></section>`:''}${isChoice&&artist?`<section class="game-panel"><h2>CHOOSE YOUR SECRET WORD</h2><p>Only you will see the selected word.</p>${words.map(w=>`<button class="big-button" data-draw-word="${esc(w)}">${esc(w)}</button>`).join('')}</section>`:`<div class="role-card"><small>${artist?'YOUR SECRET WORD':'CURRENT ARTIST'}</small><h2>${artist?esc(priv.prompt||'Choose a word to begin'):esc(r.players.find(p=>p.id===g.artistId)?.name||'Artist')} </h2><p>${artist?'Only you can see the word. Draw it without letters or numbers.':`Word: ${letters||'_ _ _ _ _'} · Guess before time runs out!`}</p></div>`}<div class="drawing-layout"><section class="game-panel drawing-panel"><div class="canvas-tools"><span>${artist?'YOUR DOODLE':'LIVE CANVAS'}</span><div><button class="color-dot" data-pen="#2a223b" style="--pen:#2a223b" title="Black"></button><button class="color-dot" data-pen="#ffffff" style="--pen:#ffffff" title="White"></button><button class="color-dot" data-pen="#ff4d6d" style="--pen:#ff4d6d" title="Red"></button><button class="color-dot" data-pen="#ff914d" style="--pen:#ff914d" title="Orange"></button><button class="color-dot" data-pen="#ffd166" style="--pen:#ffd166" title="Yellow"></button><button class="color-dot" data-pen="#8de0c2" style="--pen:#8de0c2" title="Green"></button><button class="color-dot" data-pen="#4d96ff" style="--pen:#4d96ff" title="Blue"></button><button class="color-dot" data-pen="#a78bfa" style="--pen:#a78bfa" title="Purple"></button><button class="color-dot" data-pen="#ff91c8" style="--pen:#ff91c8" title="Pink"></button><button class="color-dot" data-pen="#8b5e3c" style="--pen:#8b5e3c" title="Brown"></button><button class="small-action" data-erase="true">ERASER</button><button class="small-action" data-width="2">S</button><button class="small-action" data-width="5">M</button><button class="small-action" data-width="9">L</button>${artist?'<button class="small-action" data-action="clear-drawing">CLEAR</button>':''}</div></div><canvas id="draw-canvas" width="640" height="360" aria-label="Shared drawing canvas" ${!artist||isChoice?'class="readonly-canvas"':''}></canvas><p class="fine-print">${artist?'Draw with strokes only; letters and numbers are not allowed.':'Watch the artist draw in real time.'}</p></section><section class="game-panel"><h2>GUESS THE DOODLE</h2><div class="guess-feed">${(g.guesses||[]).slice(-8).map(q=>`<p><b>${esc(q.name)}:</b> ${esc(q.text)}</p>`).join('')||'<p class="waiting-text">Guesses appear here live.</p>'}</div>${!artist&&!isChoice&&r.phase==='draw'&&!priv.guessed?`<div class="guess-input-row"><input id="draw-guess-input" maxlength="100" placeholder="I think it’s…"><button class="join-button" data-action="draw-guess">GUESS ↗</button></div>`:priv.guessed?'<p class="waiting-text">Correct! You have already scored for this word.</p>':''}<div class="drawing-scores">${r.players.slice().sort((a,b)=>b.score-a.score).map(p=>`<div>${avatarMarkup(p.avatar,'mini-sprite')} <b>${esc(p.name)}</b><strong>${p.score||0}</strong></div>`).join('')}</div></section></div></main>`}
function otherFinished(){const r=state.room;if(r?.mode==='dot-to-domination')return dotResults();const sorted=r.players.slice().sort((a,b)=>(b.score||0)-(a.score||0));const drawResult=r?.mode==='drawn-to-chaos'?r.gameData?.lastTurnResult:null;return `<main class="page-wrap winner-page"><div class="winner-crown">🏆</div>${drawResult?`<section class="game-panel reveal-panel"><div class="eyebrow">DRAWN TO CHAOS · FINAL TURN</div><h2>THE WORD WAS: ${esc(drawResult.word)}</h2><p>Artist: ${esc(drawResult.artistName)}</p><p><b>Correct guessers:</b> ${(drawResult.correctGuessers||[]).map(q=>`${esc(q.name)} (+${(r.gameData?.guesses||[]).find(v=>v.playerId===q.playerId&&v.correct)?.points||0})`).join(', ')||'Nobody guessed it in time.'}</p></section>`:''}<div class="eyebrow">MATCH COMPLETE</div><h1 class="page-title">${esc(r.winner||'THE SQUAD')}<br><span class="pink">WINS THE CHAOS!</span></h1><div class="leaderboard">${sorted.map((p,i)=>`<div class="result-row ${i===0?'champion':''}"><span class="rank">${i===0?'<span class="pixel-crown">1</span>':i+1}</span><span class="result-avatar">${avatarMarkup(p.avatar,'result-sprite')}</span><b>${esc(p.name)}</b><strong>${p.score||0} pts</strong></div>`).join('')}</div><p class="lead center">${modeInfo[r.mode]?.name||'Mini-game'} complete. These are the combined party scores so far.</p>${partyResultActions(r)} </main>`}
function partyResultActions(r){return `${host()?((r.playlistIndex||0)<(r.playlist||[r.mode]).length-1?`<button class="big-button" data-action="next-game">NEXT GAME →</button>`:`<button class="big-button" data-action="rematch">PLAY PARTY AGAIN</button>`):'<p class="waiting-text">Waiting for the host to continue the party…</p>'}<button class="soft-button" data-action="leave">BACK TO HOME</button>`}
function dotResults(){const r=state.room,g=r.gameData||{},order=new Map((g.finishOrder||[]).map((id,i)=>[id,i+1]));const sorted=[...r.players].sort((a,b)=>(order.get(a.id)||99)-(order.get(b.id)||99));const winner=sorted.find(p=>order.has(p.id));return `<main class="page-wrap winner-page dot-results"><div class="eyebrow">DOT TO DOMINATION · ROUND RESULTS</div><h1 class="page-title">${winner?`${esc(winner.name)} <span class="pink">RULES THE GRID!</span>`:'TIME’S UP. <span class="pink">NO FINISHERS.</span>'}</h1><p class="lead center">${winner?'First valid path wins the round.':'Nobody completed the path before the timer ended.'}</p><div class="leaderboard">${sorted.map((p,i)=>`<div class="result-row ${i===0&&order.has(p.id)?'champion':''}"><span class="rank">${order.get(p.id)||'—'}</span><span class="result-avatar">${avatarMarkup(p.avatar,'result-sprite')}</span><b>${esc(p.name)}<small class="dot-result-status">${order.has(p.id)?`FINISHED ${order.get(p.id)===1?'1ST':order.get(p.id)===2?'2ND':order.get(p.id)===3?'3RD':`#${order.get(p.id)}`}`:'DID NOT FINISH'}</small></b><strong>+${p.dotPoints||0} <small>ROUND</small><br><span class="dot-total">${p.score||0} total</span></strong></div>`).join('')}</div><p class="lead center">Cumulative room scores are preserved across the party.</p>${partyResultActions(r)}</main>`}
function dotTryMove(row,col){const r=state.room,g=r?.gameData;if(!g||r.phase!=='solving'||me()?.dotFinished)return;const path=state.dotRoundId===g.roundId?state.dotPath:[];const key=c=>`${c.row},${c.col}`;const cell={row,col};if(!path.length){if(g.grid[row]?.[col]!==1){state.dotMessage='Start on checkpoint 1.';render();return;}state.dotRoundId=g.roundId;state.dotPath=[cell];state.dotMessage='Good start! Continue to checkpoint 2.';render();return;}if(path.some(c=>key(c)===key(cell))){state.dotMessage='That cell is already in your path. Choose a new cell or undo.';render();return;}const last=path[path.length-1];if(Math.abs(last.row-row)+Math.abs(last.col-col)!==1){state.dotMessage='Choose an adjacent cell. Diagonal moves and jumps are not allowed.';render();return;}const checkpoint=g.grid[row][col];const expected=Math.max(1,...path.map(c=>g.grid[c.row][c.col]||0))+1;if(checkpoint&&checkpoint!==expected){state.dotMessage=`Connect checkpoint ${expected} next.`;render();return;}if(path.some(c=>g.grid[c.row][c.col]===g.finalNumber)){state.dotMessage='You reached the final checkpoint. Submit your path.';render();return;}state.dotPath=[...path,cell];state.dotMessage=checkpoint===g.finalNumber?'Final checkpoint reached! Submit your path.':'Path extended.';render();}
function dotUndo(){if(!state.dotPath.length)return;state.dotPath=state.dotPath.slice(0,-1);state.dotMessage='Last cell removed.';render();}
function dotReset(){state.dotPath=[];state.dotMessage='Path reset. Start at checkpoint 1.';render();}
function redrawDrawingCanvas(){const canvas=$('#draw-canvas');if(!canvas)return;const ctx=canvas.getContext('2d');ctx.globalCompositeOperation='source-over';ctx.fillStyle='#fff7e8';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.lineCap='round';ctx.lineJoin='round';for(const st of state.drawingStrokes)drawStroke(ctx,st);}
function bindDrawing(){const canvas=$('#draw-canvas');if(!canvas)return;redrawDrawingCanvas();const isArtist=state.room?.gameData?.artistId===socket.id&&state.room?.phase==='draw';if(!isArtist)return;let drawing=false,current=null;const point=e=>{const b=canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(e.clientX-b.left)/b.width)),y:Math.max(0,Math.min(1,(e.clientY-b.top)/b.height))}};const publish=()=>{if(current)socket.emit('draw:stroke',{stroke:{...current,roundId:state.drawingRoundId}})};canvas.onpointerdown=e=>{drawing=true;canvas.setPointerCapture(e.pointerId);current={strokeId:`${socket.id}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,roundId:state.drawingRoundId,color:state.pen||'#2a223b',width:state.brushWidth||4,mode:state.erasing?'erase':'draw',points:[point(e)]};state.drawingStrokes.push(current);publish();redrawDrawingCanvas();};canvas.onpointermove=e=>{if(!drawing||!current)return;current.points.push(point(e));publish();redrawDrawingCanvas();};const finish=()=>{if(!drawing||!current)return;drawing=false;publish();current=null;};canvas.onpointerup=finish;canvas.onpointercancel=finish;document.querySelectorAll('[data-pen]').forEach(b=>b.onclick=()=>{state.pen=b.dataset.pen;state.erasing=false;document.querySelectorAll('[data-pen]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('[data-erase]').forEach(x=>x.classList.remove('active'));});document.querySelectorAll('[data-width]').forEach(b=>b.onclick=()=>{state.brushWidth=Number(b.dataset.width);document.querySelectorAll('[data-width]').forEach(x=>x.classList.toggle('active',x===b));});document.querySelectorAll('[data-erase]').forEach(b=>b.onclick=()=>{state.erasing=!state.erasing;b.classList.toggle('active',state.erasing);});}
function drawStroke(ctx,st){if(!st.points?.length)return;ctx.save();ctx.globalCompositeOperation=st.mode==='erase'?'destination-out':'source-over';ctx.strokeStyle=st.color||'#2a223b';ctx.lineWidth=st.width||4;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(st.points[0].x*ctx.canvas.width,st.points[0].y*ctx.canvas.height);if(st.points.length===1){ctx.lineTo(st.points[0].x*ctx.canvas.width+0.1,st.points[0].y*ctx.canvas.height+0.1);}else st.points.slice(1).forEach(p=>ctx.lineTo(p.x*ctx.canvas.width,p.y*ctx.canvas.height));ctx.stroke();ctx.restore();}
function bindRace(){if(state.room?.mode!=='sugar-rush'||state.screen!=='game')return;const sprint=()=>{if(state.raceX>=100)return;state.raceX=Math.min(100,state.raceX+2.5+(state.raceJump?1.2:0));socket.emit('race:move',{x:state.raceX});};const jump=()=>{state.raceJump=true;setTimeout(()=>state.raceJump=false,450);state.raceX=Math.min(100,state.raceX+3);socket.emit('race:move',{x:state.raceX});};const run=$('[data-action="race-run"]'),j=$('[data-action="race-jump"]');if(run)run.onclick=()=>{sprint();state.raceTimer=setInterval(()=>{if(state.raceX>=100){clearInterval(state.raceTimer);return;}sprint()},140);setTimeout(()=>clearInterval(state.raceTimer),1600)};if(j)j.onclick=jump;}
function setNotice(msg){state.notice=msg;render();setTimeout(()=>{if(state.notice===msg){state.notice='';render();}},3500)}
function bind(){document.querySelectorAll('[data-session-game]').forEach(el=>el.addEventListener('click',()=>{const id=el.dataset.sessionGame;let list=(state.room?.playlist||[]).slice();if(list.includes(id)){if(list.length>1)list=list.filter(x=>x!==id)}else if(list.length<4)list.push(id);else {setNotice('A party can include up to four games.');return}socket.emit('session:set-playlist',{playlist:list});}));document.querySelectorAll('[data-sudoku-row]').forEach(el=>el.addEventListener('click',()=>{state.sudokuSelected={row:Number(el.dataset.sudokuRow),col:Number(el.dataset.sudokuCol)};document.querySelectorAll('.sudoku-cell').forEach(c=>c.classList.toggle('active',c===el));}));document.querySelectorAll('[data-sudoku-value]').forEach(el=>el.addEventListener('click',()=>{if(!state.sudokuSelected)return setNotice('Choose an empty square first.');socket.emit('sudoku:fill',{...state.sudokuSelected,value:Number(el.dataset.sudokuValue)});state.sudokuSelected=null;}));document.querySelectorAll('[data-mode]').forEach(el=>el.addEventListener('click',()=>{const id=el.dataset.mode;state.selectedMode=id;if(state.selectedGames.includes(id)){if(state.selectedGames.length>1)state.selectedGames=state.selectedGames.filter(x=>x!==id)}else state.selectedGames.push(id);localStorage.setItem('ooo-mode',state.selectedMode);render()}));document.querySelectorAll('[data-draw-word]').forEach(el=>el.addEventListener('click',()=>socket.emit('draw:choose-word',{word:el.dataset.drawWord})));
document.querySelectorAll('[data-dot-cell]').forEach(el => {
  el.addEventListener('click', () => {
    const [row, col] = el.dataset.dotCell.split(',').map(Number);
    dotTryMove(row, col);
  });
});


document.querySelectorAll('[data-action]').forEach(el => {
  el.addEventListener('click', () => {
    const clickedAction = el.dataset.action;

    if (clickedAction === 'toggle-sound') {
      sound.toggle();
      return;
    }

    if (!el.disabled) sound.play('click');

    console.log('BUTTON CLICKED:', clickedAction);
    action(clickedAction);
  });
});

document.querySelectorAll('[data-avatar]').forEach(el=>el.addEventListener('click',()=>{state.avatar=el.dataset.avatar;localStorage.setItem('ooo-avatar',state.avatar);document.querySelectorAll('[data-avatar]').forEach(b=>b.classList.toggle('selected',b===el));}));const name=$('#display-name');if(name)name.addEventListener('input',()=>state.name=name.value);const code=$('#join-code');if(code)code.addEventListener('input',()=>{code.value=code.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4)});document.querySelectorAll('[data-fruit]').forEach(el=>{el.addEventListener('click',()=>socket.emit('smoothie:add',{fruitId:el.dataset.fruit}));el.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',el.dataset.fruit);e.dataTransfer.effectAllowed='copy';});});document.querySelectorAll('[data-remove]').forEach(el=>el.addEventListener('click',()=>socket.emit('smoothie:remove',{index:Number(el.dataset.remove)})));const drop=$('#bowl-drop');if(drop){drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('drag-over');});drop.addEventListener('dragleave',()=>drop.classList.remove('drag-over'));drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('drag-over');const id=e.dataTransfer.getData('text/plain');if(id)socket.emit('smoothie:add',{fruitId:id});});}bindDrawing();bindRace();}
function saveName(){state.name=(state.name||'').trim().slice(0,16);if(!state.name){setNotice('Add a display name first!');return false;}localStorage.setItem('ooo-name',state.name);return true}
function action(a){if(a==='dismiss'){state.notice='';render();return}if(a==='home'){if(state.room)socket.emit('room:leave');state.room=null;state.roomCode=null;state.mySmoothie=null;state.privateGame=null;state.screen='home';render();return}if(a==='create'){if(!saveName())return;const chosen=state.selectedGames.filter(id=>Object.hasOwn(modeInfo,id));socket.emit('room:create',{name:state.name,avatar:state.avatar,isPublic:false,rounds:chosen.length,mode:chosen[0]||'smoothie-showdown',playlist:chosen.length?chosen:['smoothie-showdown']});return}if(a==='join'){if(!saveName())return;const code=$('#join-code')?.value.trim();if(!code||code.length!==4){setNotice('Enter the 4-letter room code.');return}socket.emit('room:join',{code,name:state.name,avatar:state.avatar});return}
if (a === 'copy') {
  const code = state.room?.code || state.roomCode || '';

  if (!code) {
    setNotice('No room code available to copy.');
    return;
  }

  const fallbackCopy = () => {
    const textarea = document.createElement('textarea');
    textarea.value = code;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    let copied = false;

    try {
      copied = document.execCommand('copy');
    } catch (error) {
      copied = false;
    }

    textarea.remove();

    if (copied) {
      setNotice('Room code copied!');
    } else {
      setNotice('Copy failed. Your room code is ' + code);
    }
  };

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(code)
      .then(() => setNotice('Room code copied!'))
      .catch(fallbackCopy);
  } else {
    fallbackCopy();
  }

  return;
}
if(a==='ready'){state.myReady=!state.myReady;socket.emit('player:ready',state.myReady);return}if(a==='start'){socket.emit('match:start');return}if(a==='serve'){const panel=$('.blend-panel'),btn=$('[data-action="serve"]');if(panel)panel.classList.add('mixing');if(btn){btn.disabled=true;btn.textContent='MIXING YOUR ORDER…'}setTimeout(()=>{socket.emit('smoothie:serve');},900);return}if(a==='dot-undo'){dotUndo();return}if(a==='dot-reset'){dotReset();return}if(a==='dot-submit'){const g=state.room?.gameData;if(!g||state.dotRoundId!==g.roundId)return setNotice('Start your path at checkpoint 1 first.');socket.emit('dot:submit',{roundId:g.roundId,path:state.dotPath});return}if(a==='draw-guess'){const input=$('#draw-guess-input');const guess=input?.value||'';if(!guess.trim())return;socket.emit('draw:guess',{guess,clientMessageId:`${socket.id}-${Date.now()}`});if(input)input.value='';return}if(a==='clear-drawing'){if(state.room?.gameData?.artistId!==socket.id)return;state.drawingStrokes=[];socket.emit('draw:clear',{roundId:state.drawingRoundId});redrawDrawingCanvas();return}if(a==='race-run'||a==='race-jump')return;if(a==='clear-bowl'){socket.emit('smoothie:clear');return}if(a==='rematch'){socket.emit('match:rematch');return}if(a==='next-game'){socket.emit('session:next');return}if(a==='leave'){location.reload();return}}
socket.on('connect',()=>render());socket.on('disconnect',()=>setNotice('Connection lost. Trying to reconnect...'));socket.on('room:joined',({roomCode})=>{state.roomCode=roomCode;state.screen='lobby';state.myReady=false;state.mySmoothie=null;state.notice='';render()});socket.on('room:update',r=>{if(state.screen==='home'&&!state.room)return;const nextDrawRound=r.mode==='drawn-to-chaos'?(r.gameData?.roundId||null):null;const changedDrawRound=nextDrawRound!==state.drawingRoundId;if(changedDrawRound){state.drawingRoundId=nextDrawRound;state.drawingStrokes=[];}if(r.mode==='drawn-to-chaos'&&Array.isArray(r.gameData?.strokes)){state.drawingStrokes=r.gameData.strokes.filter(st=>st.roundId===nextDrawRound);}if(r.mode==='dot-to-domination'&&r.gameData?.roundId!==state.dotRoundId){state.dotPath=[];state.dotMessage='';state.dotRoundId=r.gameData?.roundId||null;}state.room=r;if(r.status==='playing')state.screen='game';else if(r.status==='finished')state.screen='finished';else if(state.screen!=='home')state.screen='lobby';render()});socket.on('smoothie:state',s=>{state.mySmoothie=s;state.fruits=s.fruits||state.fruits;if(state.screen==='game'&&state.room?.mode==='smoothie-showdown')render()});socket.on('game:private',g=>{state.privateGame=g;if(state.screen==='game')render()});socket.on('sudoku:state',g=>{state.sudokuState=g;if(state.screen==='game'&&state.room?.mode==='sudoku-knockout')render()});socket.on('draw:stroke',st=>{if(!st||st.roundId!==state.drawingRoundId)return;const i=state.drawingStrokes.findIndex(item=>item.strokeId===st.strokeId);if(i<0)state.drawingStrokes.push(st);else state.drawingStrokes[i]=st;redrawDrawingCanvas();});socket.on('draw:clear',payload=>{if(payload?.roundId!==state.drawingRoundId)return;state.drawingStrokes=[];redrawDrawingCanvas();});socket.on('race:state',v=>{if(state.room)state.room.players=state.room.players.map(p=>({...p,...v.players.find(q=>q.id===p.id)}));if(state.screen==='game'&&state.room?.mode==='sugar-rush')render()});socket.on('dot:invalid',payload=>{state.dotMessage=payload?.message||'That path is invalid. Try again.';render()});socket.on('dot:accepted',payload=>{if(payload?.playerId===socket.id){state.dotMessage=`Path accepted! You finished in position ${payload.position} for ${payload.points} points.`;state.dotPath=state.dotPath.slice();render()}});socket.on('notice',msg=>setNotice(msg));
setInterval(()=>{if(state.screen!=='game'||!state.room)return;const left=Math.max(0,Math.ceil(((state.room.endsAt||Date.now())-Date.now())/1000));const clock=$('#round-clock');if(clock)clock.textContent=`${String(Math.floor(left/60)).padStart(2,'0')}:${String(left%60).padStart(2,'0')}`;const fill=$('#clock-fill');if(fill)fill.style.width=`${Math.max(0,left/120*100)}%`;const dotClock=$('#dot-clock');if(dotClock){const phase=state.room.phase;dotClock.textContent=phase==='countdown'?`STARTING ${left}`:`${String(Math.floor(left/60)).padStart(2,'0')}:${String(left%60).padStart(2,'0')}`;}const order=state.mySmoothie?.order;const patience=$('#patience-fill');if(patience&&order){const elapsed=(Date.now()-order.createdAt)/1000;patience.style.width=`${Math.max(0,100-elapsed/25*100)}%`;patience.classList.toggle('impatient',elapsed>17);}},250);
render();
