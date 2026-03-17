import React from 'react';
import { createRoot } from 'react-dom/client';
import { Embed } from '../src/Embed';
import { SocketIoTransporter } from '@syncit/transporter';

const RELAY_URL = 'http://localhost:3100';

function createTransporter({ uid, role }: { uid: string; role: string }) {
  return new SocketIoTransporter({ uid, role, url: RELAY_URL });
}

function EmbedPage() {
  return (
    <div>
      <div style={styles.content}>
        <h2>🎯 이 페이지가 공유됩니다</h2>
        <p>Embed 컴포넌트가 이 페이지의 DOM 변경을 녹화하여 전송합니다.</p>
        <p>오른쪽 하단의 패널에서 UID를 복사한 뒤, <a href="/app.html" target="_blank" style={{color: '#60a5fa'}}>App 페이지</a>에서 연결하세요.</p>
      </div>
      <Embed createTransporter={createTransporter} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  content: {
    maxWidth: 600,
    margin: '60px auto',
    padding: 32,
    color: '#f1f5f9',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
};

const root = createRoot(document.getElementById('root')!);
root.render(<EmbedPage />);
