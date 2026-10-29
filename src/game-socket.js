import { io as socketIo } from 'socket.io-client';

// Automatically connects to localhost during 'npm run dev',
// and connects to your live Render backend when published online.
const BACKEND_URL = import.meta.env.DEV 
  ? 'http://localhost:3000' 
  : 'https://ooo-backend.onrender.com'; // <-- Put your exact Render URL here

export function createGameSocket() {
  return socketIo(BACKEND_URL, {
    transports: ['websocket', 'polling']
  });
}