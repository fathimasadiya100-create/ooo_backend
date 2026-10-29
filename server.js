import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });
const PORT = process.env.PORT || 3000;
const rooms = new Map();
const avatars = ['pixel-fox','pixel-frog','pixel-cat','pixel-bunny','pixel-bear','pixel-axolotl','pixel-star','pixel-mochi'];
const colors = ['#ffd166','#8de0c2','#c7a5ff','#ff91a4','#86d4ff','#f7bd91','#c5e86c','#ffb8e7','#ff986b','#9bafff','#f5e7a1','#9de7ef'];
const FRUITS = [
  { id:'strawberry', name:'Strawberry', emoji:'🍓', cost:3 },
  { id:'banana', name:'Banana', emoji:'🍌', cost:2 },
  { id:'blueberry', name:'Blueberry', emoji:'🫐', cost:4 },
  { id:'mango', name:'Mango', emoji:'🥭', cost:4 },
  { id:'kiwi', name:'Kiwi', emoji:'🥝', cost:3 },
  { id:'pineapple', name:'Pineapple', emoji:'🍍', cost:3 }
];
const ROUND_MS = 120000;
const SUDOKU_MODES = ['smoothie-showdown','dot-to-domination','drawn-to-chaos','sudoku-knockout'];
function makeSudoku() { const solution = Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>(r*3+Math.floor(r/3)+c)%9+1)); const puzzle=solution.map(row=>row.slice()); let removed=0; while(removed<42){const r=Math.floor(Math.random()*9),c=Math.floor(Math.random()*9);if(puzzle[r][c]!==0){puzzle[r][c]=0;removed++;}} return {puzzle,solution}; }
const LEADERBOARD_FILE = path.join(__dirname, 'leaderboard.json');
let lifetimeLeaderboard = [];
try { lifetimeLeaderboard = JSON.parse(fs.readFileSync(LEADERBOARD_FILE, 'utf8')); if (!Array.isArray(lifetimeLeaderboard)) lifetimeLeaderboard = []; } catch { lifetimeLeaderboard = []; }
const code = () => Math.random().toString(36).slice(2, 6).toUpperCase();
const safeName = (s) => String(s || 'Player').trim().replace(/[<>]/g, '').slice(0, 16) || 'Player';
const safeAvatar = (s) => avatars.includes(s) ? s : choose(avatars);
const MODES = ['smoothie-showdown','dot-to-domination','drawn-to-chaos','sudoku-knockout'];
const choose = (arr) => arr[Math.floor(Math.random() * arr.length)];
const fruitById = (id) => FRUITS.find(f => f.id === id);
function makeOrder() {
  const first = choose(FRUITS);
  let second = choose(FRUITS.filter(f => f.id !== first.id));
  if (Math.random() < 0.18) second = choose(FRUITS.filter(f => f.id !== first.id));
  const target = Math.random() < 0.22 ? { [first.id]: 2, [second.id]: 2 } : { [first.id]: 2, [second.id]: 1 };
  const names = Object.keys(target).map(id => fruitById(id).name.toLowerCase());
  const customer = choose([{name:'Pip', emoji:'🐸'},{name:'Mochi',emoji:'🐻'},{name:'Bibi',emoji:'🐰'},{name:'Toast',emoji:'🦊'},{name:'Peaches',emoji:'🐱'},{name:'Kiwi',emoji:'🐼'}]);
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`, customer, target, title: `${names.map(n=>n[0].toUpperCase()+n.slice(1)).join(' + ')} smoothie`, createdAt: Date.now(), basePay: 18 + Math.floor(Math.random()*9) };
}
function freshSmoothie() { return { profit:0, revenue:0, costs:0, served:0, tips:0, order:makeOrder(), bowl:[], lastResult:null }; }
function publicRoom(r) {
  let safeGameData = r.gameData ? {...r.gameData} : null;
  if (safeGameData && r.mode==='drawn-to-chaos') { const {prompts,challenges,wordChoices,word,...visible}=safeGameData; if(r.phase!=='result'&&r.status!=='finished'){visible.guesses=(visible.guesses||[]).map(({correct,points,...guess})=>guess);visible.lastTurnResult=null;} safeGameData=visible; }
  if (safeGameData && r.mode==='sudoku-knockout') { const {solution,grids,...visible}=safeGameData; safeGameData=visible; }
  return {
    code:r.code, isPublic:r.isPublic, hostId:r.hostId, status:r.status, round:r.round, rounds:r.rounds,
    phase:r.phase, mode:r.mode || 'smoothie-showdown', playlist:r.playlist||[r.mode], playlistIndex:r.playlistIndex||0, gameData:safeGameData, endsAt:r.endsAt || null, winner:r.winner || null,
    players:[...r.players.values()].map(p=>({ id:p.id, name:p.name, avatar:p.avatar, color:p.color, ready:p.ready, score:p.score, isHost:p.id===r.hostId, profit:p.smoothie?.profit||0, served:p.smoothie?.served||0, tips:p.smoothie?.tips||0, lastResult:p.smoothie?.lastResult||null, score:p.score||0, x:p.x||0, finished:p.finished||false, sudokuProgress:r.mode==='sudoku-knockout'?(r.gameData?.progress?.[p.id]||0):0, sudokuSolved:p.sudokuSolved||false, dotFinished:p.dotFinished||false, dotPoints:p.dotPoints||0 })),
    leaderboard:lifetimeLeaderboard.slice(0,10)
  };
}
function sendPrivateState(r) {
  for (const p of r.players.values()) {
    if (p.smoothie && r.mode==='smoothie-showdown') io.to(p.id).emit('smoothie:state', { fruits:FRUITS, ...p.smoothie, timeLeft:Math.max(0, Math.ceil(((r.endsAt||Date.now())-Date.now())/1000)) });
    if (r.mode==='drawn-to-chaos' && r.gameData) io.to(p.id).emit('game:private', {prompt:p.id===r.gameData.artistId?r.gameData.word:null, wordChoices:p.id===r.gameData.artistId&&r.phase==='word-choice'?r.gameData.wordChoices:[], guessed:r.gameData.guessed?.[p.id]||false});
    if (r.mode==='sudoku-knockout' && r.gameData) io.to(p.id).emit('sudoku:state', {puzzle:r.gameData.puzzle, grid:r.gameData.grids[p.id] || r.gameData.puzzle, progress:r.gameData.progress[p.id]||0, solved:r.gameData.solved[p.id]||false});
  }
}
function emitRoom(r) { io.to(r.code).emit('room:update', publicRoom(r)); sendPrivateState(r); }
function clearRoomTimers(r) { clearInterval(r.tickTimer); r.tickTimer = null; }
function removeRoomIfEmpty(r) { if (!r.players.size) { clearRoomTimers(r); rooms.delete(r.code); } }
function updateLifetime(r) {
  const sorted = [...r.players.values()].sort((a,b)=>r.mode==='smoothie-showdown'?(b.smoothie?.profit||0)-(a.smoothie?.profit||0):r.mode==='sudoku-knockout'?(Number(b.sudokuSolved)-Number(a.sudokuSolved)) || (b.score||0)-(a.score||0):(b.score||0)-(a.score||0));
  sorted.forEach((p, i) => {
    const key = p.name.trim().toLowerCase();
    let entry = lifetimeLeaderboard.find(x => x.key === key);
    if (!entry) { entry = { key, name:p.name, points:0, wins:0, matches:0, earnings:0 }; lifetimeLeaderboard.push(entry); }
    entry.name = p.name; entry.matches += 1; entry.earnings += Math.max(0, Math.round(p.smoothie?.profit||0));
    entry.points += i===0 ? 4 : i===1 ? 2 : i===2 ? 1 : 0;
    if (i===0) entry.wins += 1;
  });
  lifetimeLeaderboard.sort((a,b)=>b.points-a.points || b.wins-a.wins || b.earnings-a.earnings);
  try { fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(lifetimeLeaderboard, null, 2)); } catch (err) { console.error('Could not save leaderboard:', err.message); }
}
function finishMatch(r) {
  if (r.status !== 'playing') return;
  clearRoomTimers(r); r.status='finished'; r.phase='finished'; r.endsAt=null;
  const sorted = [...r.players.values()].sort((a,b)=>r.mode==='smoothie-showdown'?(b.smoothie?.profit||0)-(a.smoothie?.profit||0):r.mode==='sudoku-knockout'?(Number(b.sudokuSolved)-Number(a.sudokuSolved)) || (b.score||0)-(a.score||0):(b.score||0)-(a.score||0));
sorted.forEach((p,i)=>{ p.score += i===0 ? 4 : i===1 ? 2 : i===2 ? 1 : 0; });  const partyFinal=(r.playlistIndex||0)>=(r.playlist||[r.mode]).length-1;
  r.winner = (partyFinal ? [...r.players.values()].sort((a,b)=>(b.score||0)-(a.score||0))[0] : sorted[0])?.name || null;
  updateLifetime(r); emitRoom(r);
}

// Dot to Domination uses a verified 6x6 route with eight ordered checkpoints.
// Numbered checkpoints are placed on this known-valid route so each puzzle is solvable.

const DOT_ROUTE = Array.from({length:6}, (_, row) =>
  Array.from({length:6}, (_, col) => ({
    row,
    col: row % 2 === 0 ? col : 5-col
  }))
).flat();

const DOT_SIZE = 6;
const DOT_CELL_COUNT = DOT_SIZE * DOT_SIZE;
const DOT_CHECKPOINT_COUNT = 8;
const DOT_WALL_COUNT = 6;

const dotKey = (cell) => `${cell.row},${cell.col}`;

function dotNeighbors(cell) {
  return [
    { row: cell.row - 1, col: cell.col },
    { row: cell.row + 1, col: cell.col },
    { row: cell.row, col: cell.col - 1 },
    { row: cell.row, col: cell.col + 1 }
  ].filter(
    c => c.row >= 0 && c.row < DOT_SIZE &&
         c.col >= 0 && c.col < DOT_SIZE
  );
}

function dotEdgeKey(a, b) {
  return [dotKey(a), dotKey(b)].sort().join('|');
}

function findDotRoute() {
  const start = { row: 0, col: 0 };
  const end = { row: 5, col: 0 };

  for (let attempt = 0; attempt < 200; attempt++) {
    const path = [start];
    const visited = new Set([dotKey(start)]);

    function search(current) {
      if (path.length === DOT_CELL_COUNT) {
        return dotKey(current) === dotKey(end);
      }

      const candidates = dotNeighbors(current).filter(c => {
        if (visited.has(dotKey(c))) return false;

        // The endpoint must be the final cell.
        if (dotKey(c) === dotKey(end)) {
          return path.length === DOT_CELL_COUNT - 1;
        }

        return true;
      });

      // Prefer cells with fewer remaining exits, but randomize ties.
      candidates.sort((a, b) => {
        const degree = c =>
          dotNeighbors(c).filter(n =>
            !visited.has(dotKey(n)) &&
            dotKey(n) !== dotKey(end)
          ).length;

        return degree(a) - degree(b) + Math.random() * 0.8 - 0.4;
      });

      for (const next of candidates) {
        const key = dotKey(next);
        path.push(next);
        visited.add(key);

        if (search(next)) return true;

        path.pop();
        visited.delete(key);
      }

      return false;
    }

    if (search(start)) return path.map(c => ({ ...c }));
  }

  // A known-valid fallback prevents a server crash.
  return Array.from({ length: DOT_SIZE }, (_, row) =>
    Array.from({ length: DOT_SIZE }, (_, col) => ({
      row,
      col: row % 2 === 0 ? col : DOT_SIZE - 1 - col
    }))
  ).flat();
}

function makeDotPuzzle() {
  const route = findDotRoute();
  const grid = Array.from(
    { length: DOT_SIZE },
    () => Array(DOT_SIZE).fill(0)
  );

  // Place checkpoints at varied positions along the solution.
  const indices = [0];
  const available = Array.from(
    { length: DOT_CELL_COUNT - 2 },
    (_, i) => i + 1
  );

  // Keep checkpoint gaps varied but avoid adjacent checkpoints.
  while (indices.length < DOT_CHECKPOINT_COUNT - 1) {
    const last = indices[indices.length - 1];
    const remainingSlots =
      DOT_CHECKPOINT_COUNT - 1 - indices.length;

    const min = last + 3;
    const max = DOT_CELL_COUNT - 2 - remainingSlots * 3;

    const candidates = available.filter(
      i => i >= min && i <= max && !indices.includes(i)
    );

    if (!candidates.length) break;

    indices.push(
      candidates[Math.floor(Math.random() * candidates.length)]
    );
  }

  indices.push(DOT_CELL_COUNT - 1);
  indices.sort((a, b) => a - b);

  indices.forEach((index, i) => {
    const cell = route[index];
    grid[cell.row][cell.col] = i + 1;
  });

  const routeEdges = new Set(
    route.slice(1).map((cell, i) =>
      dotEdgeKey(route[i], cell)
    )
  );

  const possibleWalls = [];

  for (let row = 0; row < DOT_SIZE; row++) {
    for (let col = 0; col < DOT_SIZE; col++) {
      const cell = { row, col };

      for (const next of [
        { row: row + 1, col },
        { row, col: col + 1 }
      ]) {
        if (next.row >= DOT_SIZE || next.col >= DOT_SIZE) continue;

        const key = dotEdgeKey(cell, next);
        if (!routeEdges.has(key)) {
          possibleWalls.push({ a: cell, b: next });
        }
      }
    }
  }

  // Shuffle candidate walls.
  for (let i = possibleWalls.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [possibleWalls[i], possibleWalls[j]] =
      [possibleWalls[j], possibleWalls[i]];
  }

  const walls = possibleWalls.slice(0, DOT_WALL_COUNT);
  const checkpoints = {};

  grid.forEach((row, r) => row.forEach((n, c) => {
    if (n) checkpoints[n] = { row: r, col: c };
  }));

  const verified = validateDotPath(route, grid, walls);

  if (!verified.valid) {
    throw new Error(
      `Generated Dot puzzle failed validation: ${verified.message}`
    );
  }

  return {
    id: `dot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    size: DOT_SIZE,
    grid,
    walls,
    checkpoints,
    finalNumber: DOT_CHECKPOINT_COUNT
  };
}

function validateDotPath(path, grid, walls = []) {
  if (!Array.isArray(path) || path.length !== DOT_CELL_COUNT) {
    return {
      valid: false,
      message: 'Visit every cell exactly once!'
    };
  }

  const normalize = cell =>
    Array.isArray(cell)
      ? { row: cell[0], col: cell[1] }
      : cell;

  const cells = path.map(normalize);
  const key = dotKey;

  for (const cell of cells) {
    if (
      !cell ||
      !Number.isInteger(cell.row) ||
      !Number.isInteger(cell.col) ||
      cell.row < 0 || cell.row >= DOT_SIZE ||
      cell.col < 0 || cell.col >= DOT_SIZE
    ) {
      return { valid: false, message: 'That path leaves the grid.' };
    }
  }

  if (grid[cells[0].row][cells[0].col] !== 1) {
    return {
      valid: false,
      message: 'Start at checkpoint 1.'
    };
  }

  if (grid[cells.at(-1).row][cells.at(-1).col] !== DOT_CHECKPOINT_COUNT) {
    return {
      valid: false,
      message: `Finish at checkpoint ${DOT_CHECKPOINT_COUNT}.`
    };
  }

  const visited = new Set();

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const cellKey = key(cell);

    if (visited.has(cellKey)) {
      return {
        valid: false,
        message: 'You cannot visit the same cell twice.'
      };
    }

    visited.add(cellKey);

    if (i === 0) continue;

    const prev = cells[i - 1];

    if (
      Math.abs(prev.row - cell.row) +
      Math.abs(prev.col - cell.col) !== 1
    ) {
      return {
        valid: false,
        message: 'Move one cell at a time. No diagonal moves!'
      };
    }

    if (walls.some(w =>
      (key(w.a) === key(prev) && key(w.b) === cellKey) ||
      (key(w.b) === key(prev) && key(w.a) === cellKey)
    )) {
      return {
        valid: false,
        message: 'A wall blocks that connection!'
      };
    }
  }

  // Enforce checkpoints in ascending order.
  let nextCheckpoint = 2;

  for (let i = 1; i < cells.length; i++) {
    const cell = cells[i];
    const checkpoint = grid[cell.row][cell.col];

    if (checkpoint && checkpoint !== nextCheckpoint) {
      return {
        valid: false,
        message: `Visit checkpoint ${nextCheckpoint} next.`
      };
    }

    if (checkpoint) nextCheckpoint++;
  }

  if (nextCheckpoint !== DOT_CHECKPOINT_COUNT + 1) {
    return {
      valid: false,
      message: 'Connect every checkpoint in order.'
    };
  }

  return { valid: true, message: 'Perfect path!' };
}

function finishDotRound(r) {
  if (!r || r.status !== 'playing' || r.mode !== 'dot-to-domination' || r.gameData?.resolved) return;
  const g = r.gameData;
  g.resolved = true;
  for (const p of r.players.values()) {
    if (!g.results[p.id]) g.results[p.id] = {finished:false, position:null, points:0};
    p.dotFinished = !!g.results[p.id].finished;
    p.dotPoints = g.results[p.id].points || 0;
  }
  r.phase = 'result';
  finishMatch(r);
}

function startDrawTurn(r) {
  if (!r || r.status!=='playing' || r.mode!=='drawn-to-chaos') return;
  const g=r.gameData; const ids=[...r.players.keys()];
  if (!ids.length) return finishMatch(r);
  g.artistIndex=(g.artistIndex||0)%ids.length; g.artistId=ids[g.artistIndex]; g.roundId=`${r.code}-draw-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  

  const DRAW_PROMPTS = [
    // Animals & creatures
    'Peacock', 'Octopus', 'Flamingo', 'Jellyfish',
    'Crocodile', 'Kangaroo', 'Bathtub', 'Hedgehog', 'Chameleon',
  
    // Objects
    'Telescope', 'Compass', 'Typewriter', 'Binoculars',
    'Dreamcatcher', 'Skateboard', 'Parachute', 'Microscope',
  
    // Food
    'Croissant', 'Sushi', 'Pineapple', 'Milkshake', 'Pretzel',
    'Cupcake', 'Dumpling', 'Coconut', 'Popcorn', 'Pancakes',
  
    // Places & things
    'Lighthouse', 'Pyramid', 'Igloo', 'Windmill', 'Aquarium',
    'Labyrinth', 'Skyscraper', 'Greenhouse', 'Treehouse',
  
    // Fantasy & characters
    'Werewolf', 'Vampire', 'Unicorn', 'Scarecrow', 'Mummy',
    'Centaur', 'Genie', 'Mermaid', 'Gladiator', 'Astronaut',
  
    // Nature & science
    'Eclipse', 'Tornado', 'Aurora', 'Fossil', 'Meteor',
    'Quicksand', 'Coral', 'Tsunami', 'Constellation', 'Volcano',
  
    // Random and challenging
    'Magnet', 'Pendulum', 'Windchime', 'Pinwheel', 'Origami',
    'Marionette', 'Hourglass', 'Snowglobe', 'Ferriswheel',
  
    // Actions & concepts
    'Teleportation', 'Invisibility', 'Gravity', 'Illusion', 'Timebomb',
    'Hypnosis', 'Earthquake', 'Blackhole', 'Reflection', 'Transformation'
  ];
  g.wordChoices = [...new Set(
    Array.from({ length: 3 }, () => choose(DRAW_PROMPTS))
  )].slice(0, 3);
  
  while (g.wordChoices.length < 3) {
    const remaining = DRAW_PROMPTS.filter(
      word => !g.wordChoices.includes(word)
    );
    g.wordChoices.push(choose(remaining));
  }

  g.word=null; g.wordMask=''; g.guesses=[]; g.guessed={}; g.strokes=[]; g.turnStartedAt=Date.now(); g.turnEndsAt=Date.now()+65000; r.endsAt=g.turnEndsAt; r.phase='word-choice'; emitRoom(r);
}
function advanceDrawTurn(r) {
  if (!r || r.status!=='playing' || r.mode!=='drawn-to-chaos' || r.phase==='result') return;
  const g=r.gameData; const artist=r.players.get(g.artistId);
  g.lastTurnResult={roundId:g.roundId,word:g.word||'(no word selected)',artistId:g.artistId,artistName:artist?.name||'Artist',correctGuessers:g.guesses.filter(q=>q.correct).map(q=>({playerId:q.playerId,name:q.name,at:q.at})),endedAt:Date.now()};
  g.phase='result'; r.phase='result'; r.endsAt=Date.now()+3500; g.turnEndsAt=r.endsAt; emitRoom(r);
}
function nextDrawTurn(r) {
  if (!r || r.status!=='playing' || r.mode!=='drawn-to-chaos' || r.phase!=='result') return;
  const g=r.gameData;
  if (g.turnsCompleted+1>=r.players.size) { g.turnsCompleted++; finishMatch(r); return; }
  g.turnsCompleted++; g.artistIndex=(g.artistIndex+1)%Math.max(1,r.players.size); startDrawTurn(r);
}
function revealDrawHint(g) {
  if (!g.word || !g.word.length) return;
  const letters=g.word.split(''); const reveal=Math.min(letters.length,Math.floor((Date.now()-g.turnStartedAt)/15000));
  const indices=letters.map((c,i)=>c!==' '&&/[a-z]/i.test(c)?i:-1).filter(i=>i>=0);
  for(let i=0;i<reveal && indices.length;i++){const j=indices[(i*2)%indices.length];letters[j]=g.word[j];}
  g.wordMask=letters.map((c,i)=>c===' '? ' ' : (/[a-z]/i.test(c) && c===g.word[i] && indices.slice(0,reveal).includes(i) ? c.toUpperCase() : '_')).join('');
}

function startMatch(r, socket) {
  if (r.mode==='dot-to-domination' && r.status!=='lobby') return socket.emit('notice','Dot to Domination is already active or finished.');
  if (socket.id !== r.hostId) return socket.emit('notice','Only the host can start the match.');
  if (r.players.size < 2) return socket.emit('notice','Invite at least one more player first.');
  if (r.players.size > 8) return socket.emit('notice','This room supports up to eight players.');
  clearRoomTimers(r); r.status='playing'; r.phase='making'; r.round=1; r.winner=null; r.lastBroadcastSecond=null;
  const duration = r.mode==='dot-to-domination'?3000:r.mode==='drawn-to-chaos'?65000*Math.max(1,r.players.size):r.mode==='sudoku-knockout'?300000:ROUND_MS; r.endsAt=Date.now()+duration;
  for (const p of r.players.values()) { p.x=0; p.finished=false; p.sudokuSolved=false; p.dotFinished=false; p.dotPoints=0; p.smoothie=r.mode==='smoothie-showdown'?freshSmoothie():null; }
  if(r.mode==='dot-to-domination'){const puzzle=makeDotPuzzle();r.phase='countdown';r.gameData={...puzzle,roundId:`${r.code}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,startedAt:null,finishOrder:[],results:{},resolved:false};}

  if(r.mode==='drawn-to-chaos'){r.gameData={artistIndex:0,artistId:null,wordChoices:[],word:null,wordMask:'',strokes:[],guessed:{},guesses:[],turnsCompleted:0,phase:'word-choice',lastTurnResult:null,createdAt:Date.now()};startDrawTurn(r);}
  if(r.mode==='sudoku-knockout'){r.phase='solving';const board=makeSudoku();r.gameData={...board,grids:Object.fromEntries([...r.players.keys()].map(id=>[id,board.puzzle.map(row=>row.slice())])),progress:Object.fromEntries([...r.players.keys()].map(id=>[id,0])),solved:{},createdAt:Date.now()};}
  if(r.mode==='sudoku-knockout'){for(const p of r.players.values())p.sudokuSolved=false;}
  emitRoom(r);
  r.tickTimer=setInterval(()=>{
    if (!rooms.has(r.code) || r.status!=='playing') return clearRoomTimers(r);
    if (r.mode==='dot-to-domination' && r.phase==='countdown' && Date.now() >= r.endsAt) { r.phase='solving';r.gameData.startedAt=Date.now();r.endsAt=r.gameData.startedAt+120000;emitRoom(r); }
    else if (r.mode==='drawn-to-chaos' && r.phase==='result' && Date.now()>=r.endsAt) { nextDrawTurn(r); } else if (Date.now() >= r.endsAt) { if(r.mode==='sudoku-knockout') { r.phase='result'; return finishMatch(r); } if(r.mode==='dot-to-domination'){finishDotRound(r);return;} if(r.mode==='drawn-to-chaos'){advanceDrawTurn(r);return;} return finishMatch(r); } if(r.mode==='drawn-to-chaos'&&r.phase==='draw'){revealDrawHint(r.gameData);if(r.gameData.guessed&&Object.keys(r.gameData.guessed).filter(id=>id!==r.gameData.artistId&&r.gameData.guessed[id]).length>=r.players.size-1)advanceDrawTurn(r); }
    // Broadcast the authoritative clock periodically; clients animate the countdown locally.
    const secondsLeft=Math.ceil((r.endsAt-Date.now())/1000); if (secondsLeft%5===0 && r.lastBroadcastSecond!==secondsLeft) { r.lastBroadcastSecond=secondsLeft; emitRoom(r); }
  }, 250);
}
function findRoomFor(socket) { for (const r of rooms.values()) if (r.players.has(socket.id)) return r; return null; }
function updateAfterAction(r) { emitRoom(r); }

app.get('/health', (_req,res)=>res.json({ok:true, rooms:rooms.size, game:'ODD ONE OUT'}));
app.get('/api/leaderboard', (_req,res)=>res.json(lifetimeLeaderboard.slice(0,20)));
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (_req,res)=>res.sendFile(path.join(__dirname, 'dist', 'index.html')));
}

function createRoomForSocket(socket, {name,avatar,isPublic=false,rounds=5,mode='smoothie-showdown',playlist=[]}={}, io, rooms) {
  let roomCode=code(); while(rooms.has(roomCode)) roomCode=code();
  mode=MODES.includes(mode)?mode:'smoothie-showdown';
  const p={id:socket.id,name:safeName(name),avatar:safeAvatar(avatar),color:colors[Math.floor(Math.random()*colors.length)],ready:true,score:0,smoothie:null,x:0,finished:false};
  const validPlaylist=[...new Set((Array.isArray(playlist)?playlist:[]).filter(x=>MODES.includes(x)))].slice(0,4); if(!validPlaylist.length)validPlaylist.push(mode);
  const r={code:roomCode,mode:validPlaylist[0]||mode,playlist:validPlaylist,playlistIndex:0,isPublic:!!isPublic,hostId:socket.id,status:'lobby',phase:'lobby',round:0,rounds:1,players:new Map([[socket.id,p]]),winner:null,endsAt:null,tickTimer:null,gameData:null};
  rooms.set(roomCode,r); socket.join(roomCode); socket.emit('room:joined',{roomCode}); socket.emit('roomCreated',{roomId:roomCode,roomCode}); emitRoom(r);
}
function joinRoomForSocket(socket, {code:roomCode,name,avatar}={}, io, rooms) {
  const r=rooms.get(String(roomCode||'').trim().toUpperCase());
  if(!r) return socket.emit('roomJoinError',{message:'That room code does not exist. Check it and try again.'});
  if(r.status!=='lobby') return socket.emit('roomJoinError',{message:'That match has already started. Ask the host to make a new room.'});
  if(r.players.size>=8) return socket.emit('roomJoinError',{message:'This room is full (8 players maximum).'});
  const playerName=safeName(name);
  if([...r.players.values()].some(p=>p.name.toLowerCase()===playerName.toLowerCase())) return socket.emit('roomJoinError',{message:'That display name is already in this room. Try another.'});
  const p={id:socket.id,name:playerName,avatar:safeAvatar(avatar),color:colors[Math.floor(Math.random()*colors.length)],ready:false,score:0,smoothie:null,x:0,finished:false};
  r.players.set(socket.id,p); socket.join(r.code); socket.emit('room:joined',{roomCode:r.code}); socket.emit('roomJoined',{roomId:r.code,roomCode:r.code});
  io.to(r.code).emit('playerJoined',{roomId:r.code,player:{id:p.id,name:p.name,avatar:p.avatar,color:p.color,ready:p.ready,isHost:false},players:publicRoom(r).players});
  emitRoom(r);
}
function removePlayerFromRoom(socket, io, rooms) {
  const r=findRoomFor(socket); if(!r)return;
  const departed=r.players.get(socket.id); r.players.delete(socket.id); socket.leave(r.code);
  if(r.hostId===socket.id)r.hostId=r.players.keys().next().value||null;
  if(!r.players.size){removeRoomIfEmpty(r);return;}
  const payload={roomId:r.code,player:{id:departed?.id,name:departed?.name},players:publicRoom(r).players};
  io.to(r.code).emit('playerLeft',payload);
  emitRoom(r);
  if(r.mode==='dot-to-domination' && r.status==='playing' && r.phase==='solving' && [...r.players.keys()].every(id=>r.gameData?.results?.[id]?.finished)) finishDotRound(r);
}

io.on('connection', socket => {
  socket.on('room:create', (payload={})=>createRoomForSocket(socket,payload,io,rooms));
  socket.on('room:join', (payload={})=>joinRoomForSocket(socket,payload,io,rooms));
  // Milestone 1 aliases: keep the established room:* events working for the current UI.
  socket.on('createRoom', (payload={}) => {
    const {username,name, ...rest}=payload;
    createRoomForSocket(socket, {...rest, name: username || name || 'Player'}, io, rooms);
  });
  socket.on('joinRoom', (payload={}) => {
    const roomCode=payload.roomId || payload.roomCode || payload.code;
    const username=payload.username || payload.name || 'Player';
    joinRoomForSocket(socket, {code:roomCode,name:username,avatar:payload.avatar}, io, rooms);
  });
  socket.on('room:leave',()=>removePlayerFromRoom(socket, io, rooms));
  socket.on('player:ready',ready=>{const r=findRoomFor(socket);if(r&&r.status==='lobby'){const p=r.players.get(socket.id);p.ready=!!ready;emitRoom(r);}});
  socket.on('session:set-playlist',({playlist=[]}={})=>{const r=findRoomFor(socket);if(!r||socket.id!==r.hostId||r.status!=='lobby')return;const valid=[...new Set((Array.isArray(playlist)?playlist:[]).filter(x=>MODES.includes(x)))].slice(0,4);if(!valid.length)return socket.emit('notice','Choose at least one game for the party.');r.playlist=valid;r.playlistIndex=0;r.mode=valid[0];emitRoom(r);});
  socket.on('match:start',()=>{const r=findRoomFor(socket);if(r)startMatch(r,socket);});
  socket.on('sudoku:fill',({row,col,value}={})=>{const r=findRoomFor(socket);if(!r||r.status!=='playing'||r.mode!=='sudoku-knockout'||r.phase!=='solving')return;const g=r.gameData;if(g.solved[socket.id])return; if(!Number.isInteger(row)||row<0||row>8||!Number.isInteger(col)||col<0||col>8)return; if(!Number.isInteger(value)||value<0||value>9)return; if(g.puzzle[row][col]!==0)return socket.emit('notice','That square is locked.'); const grid=g.grids[socket.id];grid[row][col]=value; 
  let correctCount = 0;
  for (let ri = 0; ri < 9; ri++) {
    for (let ci = 0; ci < 9; ci++) {
    // Only count if the player filled it AND it matches the solution, and wasn't part of the initial puzzle
      if (g.puzzle[ri][ci] === 0 && grid[ri][ci] !== 0 && grid[ri][ci] === g.solution[ri][ci]) {
        correctCount++;
    }
  }
}
g.progress[socket.id] = Math.max(0, Math.round((correctCount / 42) * 100));
const complete=grid.every((line,ri)=>line.every((n,ci)=>n===g.solution[ri][ci]));if(complete){g.solved[socket.id]=true;const p=r.players.get(socket.id);if(p&&!p.sudokuSolved){p.sudokuSolved=true;p.score+=2;g.finishOrder=(g.finishOrder||[]).concat(socket.id); if(g.finishOrder.length===1){r.winner=p.name;r.phase='result';finishMatch(r);return;}if(g.finishOrder.length===r.players.size||[...r.players.values()].every(q=>q.sudokuSolved)){r.phase='result';finishMatch(r);return;}}}emitRoom(r);});
  socket.on('smoothie:add',({fruitId}={})=>{
    const r=findRoomFor(socket); if(!r||r.status!=='playing')return; const p=r.players.get(socket.id); const s=p.smoothie; const fruit=fruitById(fruitId);
    if(!s||!fruit)return; if(s.bowl.length>=8)return socket.emit('notice','Your blender is full! Serve or clear it first.');
    s.bowl.push(fruit.id); s.costs+=fruit.cost; s.profit-=fruit.cost; s.lastResult=null; updateAfterAction(r);
  });
  socket.on('smoothie:remove',({index}={})=>{
    const r=findRoomFor(socket); if(!r||r.status!=='playing')return; const s=r.players.get(socket.id).smoothie;
    if(!s||!Number.isInteger(index)||index<0||index>=s.bowl.length)return;
    // Ingredients already used are not refunded; this is part of the profit challenge.
    s.bowl.splice(index,1); s.lastResult=null; updateAfterAction(r);
  });
  socket.on('smoothie:clear',()=>{const r=findRoomFor(socket);if(!r||r.status!=='playing')return;const s=r.players.get(socket.id).smoothie;if(s){s.bowl=[];s.lastResult=null;updateAfterAction(r);}});
  socket.on('smoothie:serve',()=>{
    const r=findRoomFor(socket); if(!r||r.status!=='playing')return; const p=r.players.get(socket.id); const s=p.smoothie;
    if(!s||!s.order||!s.bowl.length)return socket.emit('notice','Add at least one fruit before serving!');
    const counts={}; for(const id of s.bowl)counts[id]=(counts[id]||0)+1;
    const target=s.order.target; const targetUnits=Object.values(target).reduce((a,b)=>a+b,0);
    const matching=Object.keys(target).reduce((sum,id)=>sum+Math.min(counts[id]||0,target[id]),0);
    const extra=Object.keys(counts).reduce((sum,id)=>sum+(target[id]?Math.max(0,counts[id]-target[id]):counts[id]),0);
    const missing=targetUnits-matching;
    const recipeScore=Math.max(0,Math.round((matching/targetUnits)*100 - extra*12 - missing*4));
    const balancePenalty=Math.abs(s.bowl.length-targetUnits)*5;
    const quality=Math.max(0,Math.min(100,recipeScore-balancePenalty));
    const elapsed=(Date.now()-s.order.createdAt)/1000;
    const speedBonus=elapsed<7?6:elapsed<13?3:elapsed<22?1:0;
    const qualityBonus=Math.round(quality/100*18);
    const payment=Math.max(4,Math.round(s.order.basePay*(0.35+quality/100*0.65)));
    const tip=quality>=90?Math.max(2,Math.round((qualityBonus+speedBonus)*0.6)):quality>=65?Math.floor(speedBonus/2):0;
    const revenue=payment+tip;
    s.revenue+=revenue; s.tips+=tip; s.profit+=revenue; s.served+=1;
    s.lastResult={quality,payment,tip,costs:s.costs,elapsed:Math.round(elapsed),bowl:[...s.bowl],orderTitle:s.order.title,profitChange:revenue,customer:s.order.customer,customerEmoji:s.order.customer.emoji};
    s.order=makeOrder(); s.bowl=[]; updateAfterAction(r);
  });

  socket.on('dot:submit', ({roundId, path}={}) => {
    const r=findRoomFor(socket);
    if(!r || r.status!=='playing' || r.mode!=='dot-to-domination' || r.phase!=='solving') return socket.emit('dot:invalid',{message:'This puzzle is no longer active.'});
    const g=r.gameData;
    if(!r.players.has(socket.id) || roundId!==g.roundId) return socket.emit('dot:invalid',{message:'That submission belongs to a different round.'});
    if(g.results[socket.id]?.finished) return socket.emit('dot:invalid',{message:'Your valid path is already locked in.'});
    if(Date.now() >= r.endsAt) { finishDotRound(r); return socket.emit('dot:invalid',{message:'Time is up. This round has ended.'}); }
    const checked = validateDotPath(path, g.grid, g.walls);
    if(!checked.valid) return socket.emit('dot:invalid',{message:checked.message});
    const position=g.finishOrder.length+1;
    const points=position===1?100:position===2?75:position===3?50:25;
    const player=r.players.get(socket.id);
    if(!player) return;
    g.finishOrder.push(socket.id);
    g.results[socket.id]={finished:true,position,points,acceptedAt:Date.now()};
    player.dotFinished=true;player.dotPoints=points;player.score=(player.score||0)+points;
    io.to(r.code).emit('dot:accepted',{playerId:socket.id,position,points});
    if([...r.players.keys()].every(id=>g.results[id]?.finished)) finishDotRound(r); else emitRoom(r);
  });

  socket.on('draw:choose-word',({word}={})=>{const r=findRoomFor(socket);if(!r||r.status!=='playing'||r.mode!=='drawn-to-chaos'||r.phase!=='word-choice'||socket.id!==r.gameData.artistId)return;const g=r.gameData;const selected=String(word||'');if(!g.wordChoices.includes(selected))return socket.emit('notice','Choose one of the three words.');g.word=selected;g.wordMask=selected.split('').map(c=>c===' '?' ':'_').join('');g.phase='draw';r.phase='draw';g.turnStartedAt=Date.now();g.turnEndsAt=Date.now()+65000;r.endsAt=g.turnEndsAt;emitRoom(r);});
  socket.on('draw:stroke', ({stroke}={})=>{
    const r=findRoomFor(socket); if(!r||r.status!=='playing'||r.mode!=='drawn-to-chaos'||r.phase!=='draw'||socket.id!==r.gameData.artistId)return;
    const g=r.gameData; if(stroke?.roundId!==g.roundId)return;
    const strokeId=String(stroke?.strokeId||'').slice(0,100); if(!strokeId)return;
    const pts=Array.isArray(stroke?.points)?stroke.points.slice(0,500).map(p=>({x:Math.max(0,Math.min(1,Number(p.x)||0)),y:Math.max(0,Math.min(1,Number(p.y)||0))})):[]; if(!pts.length)return;
    const color=String(stroke.color||'#2a223b'); if(!/^#[0-9a-fA-F]{6}$/.test(color))return;
    const clean={roundId:g.roundId,strokeId,playerId:socket.id,color,width:Math.max(1,Math.min(24,Number(stroke.width)||4)),mode:stroke.mode==='erase'?'erase':'draw',points:pts};
    const index=g.strokes.findIndex(item=>item.strokeId===strokeId); if(index<0)g.strokes.push(clean);else g.strokes[index]=clean;
    // The server keeps one authoritative version per stroke and broadcasts updates in arrival order.
    io.to(r.code).emit('draw:stroke',clean);
  });
  socket.on('draw:clear',({roundId}={})=>{const r=findRoomFor(socket);if(!r||r.status!=='playing'||r.mode!=='drawn-to-chaos'||r.phase!=='draw'||socket.id!==r.gameData.artistId||roundId!==r.gameData.roundId)return;r.gameData.strokes=[];io.to(r.code).emit('draw:clear',{roundId:r.gameData.roundId});});
  
function isCloseDrawGuess(guess, answer) {
  const normalize = (value) =>
    String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

  const a = normalize(guess);
  const b = normalize(answer);

  if (!a || !b || a === b) return false;

  // Avoid unreliable similarity hints for very short answers.
  if (a.length < 5 || b.length < 5) return false;

  // Calculate Levenshtein edit distance.
  // This counts insertions, deletions, and substitutions.
  if (Math.abs(a.length - b.length) > 2) return false;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowMin = i;

    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      current[j] = Math.min(
        current[j - 1] + 1,       // insertion
        previous[j] + 1,          // deletion
        previous[j - 1] + cost    // substitution
      );

      rowMin = Math.min(rowMin, current[j]);
    }

    // If every candidate in this row is already too far away,
    // stop early.
    if (rowMin > 2) return false;

    previous = current;
  }

  const distance = previous[b.length];
  const maxLength = Math.max(a.length, b.length);

  // Be conservative: allow one typo for shorter answers,
  // and up to two for longer answers.
  const allowedDistance = maxLength >= 10 ? 2 : 1;

  return distance > 0 && distance <= allowedDistance;
}

socket.on('draw:guess', ({ guess, clientMessageId } = {}) => {
  const r = findRoomFor(socket);

  if (
    !r ||
    r.status !== 'playing' ||
    r.mode !== 'drawn-to-chaos' ||
    r.phase !== 'draw'
  ) return;

  const g = r.gameData;

  if (!g?.word || socket.id === g.artistId || g.guessed[socket.id]) {
    return;
  }

  const value = String(guess || '').trim().slice(0, 100);
  if (!value) return;

  const messageId = String(
    clientMessageId || `${socket.id}-${Date.now()}`
  ).slice(0, 120);

  if (g.guesses.some(q => q.id === messageId)) return;

  const player = r.players.get(socket.id);
  if (!player) return;

  const normalize = text =>
    String(text ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

  const correct = normalize(value) === normalize(g.word);
  console.log('[DRAW HINT DEBUG]', {
    guess: value,
    answer: g.word,
    correct,
    close: isCloseDrawGuess(value, g.word)
  });

  const guessRecord = {
    id: messageId,
    playerId: socket.id,
    name: player.name,
    text: value,
    at: Date.now(),
    correct
  };

  g.guesses.push(guessRecord);

  if (correct) {
    g.guessed[socket.id] = true;

    const elapsed = Math.max(0, Date.now() - g.turnStartedAt);
    const points = Math.max(1, Math.ceil(2 - elapsed / 30000));

    guessRecord.points = points;
    player.score += points;

    const artist = r.players.get(g.artistId);
    if (artist) artist.score += 1;
  } else if (isCloseDrawGuess(value, g.word)) {
    // Private hint to this player only.
    socket.emit('notice', "You're so close! Try again!");
  }

  emitRoom(r);
});

  socket.on('race:move', ({x}={})=>{const r=findRoomFor(socket);if(!r||r.status!=='playing'||r.mode!=='sugar-rush'||r.phase!=='race')return;const p=r.players.get(socket.id);if(p.finished)return;p.x=Math.max(p.x||0,Math.min(100,Number(x)||0));if(p.x>=100){p.x=100;p.finished=true;r.gameData.finishedOrder.push(socket.id);p.score+=Math.max(1,5-r.gameData.finishedOrder.length);}io.to(r.code).emit('race:state',{players:[...r.players.values()].map(q=>({id:q.id,x:q.x,finished:q.finished})),finishedOrder:r.gameData.finishedOrder});if([...r.players.values()].every(q=>q.finished))finishMatch(r);else emitRoom(r);});


  socket.on('session:next',()=>{const r=findRoomFor(socket);if(!r||socket.id!==r.hostId)return socket.emit('notice','Only the host can continue the party.');if(r.status!=='finished')return socket.emit('notice','Finish this game first.');if((r.playlistIndex||0)>=r.playlist.length-1)return socket.emit('notice','The party set is complete!');r.playlistIndex=(r.playlistIndex||0)+1;r.mode=r.playlist[r.playlistIndex];r.status='lobby';r.phase='lobby';r.round=0;r.winner=null;r.endsAt=null;r.gameData=null;for(const p of r.players.values()){p.smoothie=null;p.x=0;p.finished=false;p.ready=p.id===r.hostId;}emitRoom(r);startMatch(r,socket);});
  socket.on('match:rematch',()=>{
    const r=findRoomFor(socket);if(!r)return;if(socket.id!==r.hostId)return socket.emit('notice','Only the host can start a new match.');
    if(r.status!=='finished')return socket.emit('notice','Finish the current match first.');
    r.status='lobby';r.phase='lobby';r.round=0;r.playlistIndex=0;r.mode=r.playlist[0]||'smoothie-showdown';r.winner=null;r.endsAt=null;r.gameData=null;for(const p of r.players.values()){p.score=0;p.smoothie=null;p.x=0;p.finished=false;p.sudokuSolved=false;p.ready=p.id===r.hostId;}emitRoom(r);
  });
  socket.on('disconnect',()=>{
    for(const r of rooms.values()){
      const p=r.players.get(socket.id);if(!p)continue;r.players.delete(socket.id);
      if(r.hostId===socket.id)r.hostId=r.players.keys().next().value||null;
      if(!r.players.size){removeRoomIfEmpty(r);continue;}
      if(r.status==='playing'&&r.players.size<2){clearRoomTimers(r);r.status='lobby';r.phase='lobby';r.endsAt=null;for(const pl of r.players.values())pl.smoothie=null;io.to(r.code).emit('notice','Not enough players left. Waiting in the lobby.');}
      io.to(r.code).emit('playerLeft',{roomId:r.code,player:{id:p.id,name:p.name},players:publicRoom(r).players});
      emitRoom(r);
      if(r.mode==='dot-to-domination' && r.status==='playing' && r.phase==='solving' && [...r.players.keys()].every(id=>r.gameData?.results?.[id]?.finished)) finishDotRound(r);
    }
  });
});
httpServer.listen(PORT,'0.0.0.0',()=>console.log(`\n🥤 ODD ONE OUT: Smoothie Showdown server ready on http://localhost:${PORT}\n`));
