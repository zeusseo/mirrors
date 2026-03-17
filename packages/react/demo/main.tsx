import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Embed } from '../src/Embed';
import { App } from '../src/App';
import { SocketIoTransporter } from '@syncit/transporter';

const RELAY_URL = 'http://localhost:3100';

function createTransporter({ uid, role }: { uid: string; role: string }) {
  return new SocketIoTransporter({ uid, role, url: RELAY_URL });
}

function Demo() {
  const [mode, setMode] = useState<'select' | 'embed' | 'app'>('select');

  if (mode === 'select') {
    return (
      <div style={styles.selectContainer}>
        <h1 style={styles.heading}>Syncit React Demo</h1>
        <p style={styles.subtext}>React에서의 실시간 화면 공유</p>
        <div style={styles.buttonGroup}>
          <button onClick={() => setMode('embed')} style={styles.embedBtn}>
            📡 Embed (공유하기)
          </button>
          <button onClick={() => setMode('app')} style={styles.appBtn}>
            📺 App (미러보기)
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'embed') {
    return (
      <div style={styles.demoPage}>
        <div style={styles.demoContent}>
          <h2>🎯 이 페이지가 공유됩니다</h2>
          <p>Embed 컴포넌트가 이 페이지의 DOM 변경을 녹화하여 전송합니다.</p>
          <p>오른쪽 하단의 패널에서 UID를 복사한 뒤, App 모드에서 연결하세요.</p>
          <button onClick={() => setMode('select')} style={styles.backBtn}>← 돌아가기</button>
        </div>
        <Embed createTransporter={createTransporter} />
      </div>
    );
  }

  return (
    <div style={styles.demoPage}>
      <div style={styles.appWrapper}>
        <button onClick={() => setMode('select')} style={styles.backBtn}>← 돌아가기</button>
        <App createTransporter={createTransporter} bufferMs={100} />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  selectContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    color: '#f1f5f9',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  heading: {
    fontSize: 36,
    fontWeight: 700,
    marginBottom: 8,
  },
  subtext: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 32,
  },
  buttonGroup: {
    display: 'flex',
    gap: 16,
  },
  embedBtn: {
    padding: '16px 32px',
    fontSize: 18,
    fontWeight: 600,
    borderRadius: 12,
    border: 'none',
    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    color: '#fff',
    cursor: 'pointer',
    transition: 'transform 0.2s',
  },
  appBtn: {
    padding: '16px 32px',
    fontSize: 18,
    fontWeight: 600,
    borderRadius: 12,
    border: 'none',
    background: 'linear-gradient(135deg, #10b981, #06b6d4)',
    color: '#fff',
    cursor: 'pointer',
    transition: 'transform 0.2s',
  },
  demoPage: {
    minHeight: '100vh',
    background: '#0f172a',
    color: '#f1f5f9',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: 32,
  },
  demoContent: {
    maxWidth: 600,
    margin: '0 auto',
  },
  appWrapper: {
    maxWidth: 900,
    margin: '0 auto',
  },
  backBtn: {
    padding: '8px 16px',
    fontSize: 14,
    borderRadius: 8,
    border: '1px solid #475569',
    background: '#1e293b',
    color: '#e2e8f0',
    cursor: 'pointer',
    marginBottom: 16,
  },
};

const root = createRoot(document.getElementById('root')!);
root.render(<Demo />);
