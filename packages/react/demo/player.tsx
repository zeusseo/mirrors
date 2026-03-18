import React from 'react';
import { createRoot } from 'react-dom/client';
import { Player } from '../src/Player';

const API_URL = 'http://localhost:3100';

function PlayerDemo() {
  return <Player apiUrl={API_URL} />;
}

const root = createRoot(document.getElementById('root')!);
root.render(<PlayerDemo />);
