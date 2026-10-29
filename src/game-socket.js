// Production transport for Netlify Functions; local development keeps the original Socket.IO server.
import { io as socketIo } from 'socket.io-client';

export function createGameSocket() {
  if (import.meta.env.DEV) return socketIo();

  const listeners = new Map();
  const playerKey = 'ooo-player-id';
  let id = localStorage.getItem(playerKey);
  if (!id) {
    id = `p-${crypto.randomUUID()}`;
    localStorage.setItem(playerKey, id);
  }
  const socket = {
    id,
    connected: true,
    on(event, callback) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(callback);
      return socket;
    },
    emit(event, payload = {}) {
      fetch('/.netlify/functions/game', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ playerId: id, roomCode, event, payload })
      }).then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok && data.error) dispatch('notice', data.error);
        applySnapshot(data);
      }).catch(() => dispatch('notice', 'Could not reach the game server. Retrying…'));
      return socket;
    }
  };
  let roomCode = null;
  let eventCursor = 0;
  let stopped = false;
  let lastRoomSnapshot = '';
  let lastPrivateSnapshot = '';
  let lastSudokuSnapshot = '';
  let lastSmoothieSnapshot = '';
  const dispatch = (event, payload) => {
    for (const callback of listeners.get(event) || []) {
      try { callback(payload); } catch (error) { console.error(`Game event ${event} failed`, error); }
    }
  };
  function applySnapshot(data) {
    if (!data) return;
    if (data.playerId && data.playerId !== id) {
      id = data.playerId;
      socket.id = id;
      localStorage.setItem(playerKey, id);
    }
    if (data.roomCode) roomCode = data.roomCode;
    if (Array.isArray(data.events)) {
      for (const item of data.events) {
        if (item.id > eventCursor) {
          eventCursor = item.id;
          dispatch(item.event, item.payload);
        }
      }
    }
    if (Number.isFinite(data.latestEventId)) eventCursor = Math.max(eventCursor, data.latestEventId);
    if (data.room) {
      const r = data.room;
      roomCode = r.code || roomCode;
      const roomForCompare = structuredClone(r);
      for (const player of roomForCompare.players || []) if (player.smoothieState) delete player.smoothieState.timeLeft;
      const roomSnapshot = JSON.stringify(roomForCompare);
      if (roomSnapshot !== lastRoomSnapshot) { lastRoomSnapshot = roomSnapshot; dispatch('room:update', r); }
      if (r.mode === 'smoothie-showdown') {
        const p = r.players?.find(q => q.id === id);
        if (p?.smoothieState) { const snap = JSON.stringify({...p.smoothieState, timeLeft: 0}); if (snap !== lastSmoothieSnapshot) { lastSmoothieSnapshot = snap; dispatch('smoothie:state', p.smoothieState); } }
      }
      if (r.mode === 'drawn-to-chaos' && r.privateGame) { const snap = JSON.stringify(r.privateGame); if (snap !== lastPrivateSnapshot) { lastPrivateSnapshot = snap; dispatch('game:private', r.privateGame); } }
      if (r.mode === 'sudoku-knockout' && r.privateSudoku) { const snap = JSON.stringify(r.privateSudoku); if (snap !== lastSudokuSnapshot) { lastSudokuSnapshot = snap; dispatch('sudoku:state', r.privateSudoku); } }
      if (r.mode === 'dot-to-domination' && Array.isArray(r.gameData?.strokes)) {
        // Draw strokes are handled by the ordinary room snapshot path below for Drawn to Chaos.
      }
    }
    if (data.privateEvents) for (const item of data.privateEvents) dispatch(item.event, item.payload);
  }
  async function poll() {
    if (stopped) return;
    try {
      const query = new URLSearchParams({ playerId: id, since: String(eventCursor) });
      if (roomCode) query.set('roomCode', roomCode);
      const response = await fetch(`/.netlify/functions/game?${query}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Connection failed');
      applySnapshot(data);
      if (!socket._connected) { socket._connected = true; dispatch('connect'); }
    } catch (error) {
      if (socket._connected) { socket._connected = false; dispatch('disconnect', error); }
    } finally {
      setTimeout(poll, 650);
    }
  }
  socket.disconnect = () => { stopped = true; };
  socket._connected = false;
  setTimeout(poll, 0);
  return socket;
}
