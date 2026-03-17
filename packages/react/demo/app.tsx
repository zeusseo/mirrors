import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../src/App';
import { SocketIoTransporter } from '@syncit/transporter';

const RELAY_URL = 'http://localhost:3100';

function createTransporter({ uid, role }: { uid: string; role: string }) {
  return new SocketIoTransporter({ uid, role, url: RELAY_URL });
}

function AppPage() {
  return <App createTransporter={createTransporter} bufferMs={100} />;
}

const root = createRoot(document.getElementById('root')!);
root.render(<AppPage />);
