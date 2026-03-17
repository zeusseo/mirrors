import { useEffect, useRef, useState, useCallback } from 'react';
import { Replayer } from 'rrweb';
import 'rrweb/dist/style.css';
import type { eventWithTime } from '@rrweb/types';
import {
  TransporterEvents,
  MirrorBuffer,
  createAppService,
  type Transporter,
  type TransportSendRecordEvent,
} from '@syncit/core';

interface AppProps {
  createTransporter: (opts: { role: string; uid: string }) => Transporter;
  bufferMs?: number;
}

/**
 * Svelte App.svelte 로직을 그대로 React로 포팅.
 * playerDom은 항상 DOM에 존재하는 단순 div (조건부 렌더링 없음).
 */
export function App({ createTransporter, bufferMs = 100 }: AppProps) {
  const [uid, setUid] = useState('');
  const [status, setStatus] = useState('idle');
  const playerRef = useRef<HTMLDivElement>(null);
  const connectedRef = useRef(false);

  const connect = useCallback(() => {
    if (!uid.trim() || connectedRef.current) return;
    connectedRef.current = true;

    console.log('[App] connecting with uid:', uid);

    const transporter = createTransporter({ uid, role: 'app' });

    let replayer: Replayer | null = null;

    const buffer = new MirrorBuffer<eventWithTime>({
      bufferMs,
      onChunk({ data }) {
        replayer?.addEvent(data);
      },
    });

    const service = createAppService(() => {
      replayer?.pause();
      if (playerRef.current) playerRef.current.innerHTML = '';
      buffer.reset();
    });

    service.start();
    service.subscribe((s) => {
      setStatus(s.value as string);
    });

    // SourceReady: Embed가 준비됨 → Replayer 생성 → Start 전송
    transporter.on(TransporterEvents.SourceReady, () => {
      console.log('[App] SourceReady, service state:', service.state.value);
      if (!service.state.matches('idle')) return;

      service.send('SOURCE_READY');

      const root = playerRef.current;
      console.log('[App] playerRef.current:', root);
      if (!root) {
        console.error('[App] playerRef is null — cannot create Replayer!');
        return;
      }

      replayer = new Replayer([], {
        root,
        loadTimeout: 100,
        liveMode: true,
        insertStyleRules: [
          '.syncit-embed { display: none !important }',
        ],
        showWarning: false,
        showDebug: false,
        mouseTail: false,
      });
      transporter.sendStart();
    });

    // SendRecord: 이벤트 수신 → 버퍼에 추가 (Svelte와 동일 로직)
    transporter.on(TransporterEvents.SendRecord, (data) => {
      const { id, data: event, t } = (data as TransportSendRecordEvent).payload;

      if (!service.state.matches('connected')) {
        // Align cursor to current session's record IDs
        buffer.cursor = id - 1;
        replayer?.startLive(event.timestamp - buffer.bufferMs);
        service.send('FIRST_RECORD');
      }

      const chunk = { id, data: event, t: event.timestamp };
      buffer.addWithCheck(chunk);
      transporter.ackRecord(id);
    });

    transporter.on(TransporterEvents.Stop, () => {
      service.send('STOP');
    });

    // Login 후 MirrorReady 전송
    transporter.login().then(() => {
      console.log('[App] logged in, sending MirrorReady');
      transporter.sendMirrorReady();
    });
  }, [uid, createTransporter, bufferMs]);

  return (
    <div>
      {/* Player DIV — 항상 존재, Replayer가 여기에 iframe 생성 */}
      <div ref={playerRef} />

      {/* UI 패널 */}
      <div style={panelStyle}>
        {status === 'idle' ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="UID 입력"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && connect()}
              style={inputStyle}
            />
            <button onClick={connect} style={btnStyle}>Connect</button>
          </div>
        ) : (
          <div>
            <span style={{ color: status === 'connected' ? '#4ade80' : '#fbbf24' }}>●</span>
            {' '}UID: <code>{uid}</code> | Status: {status}
          </div>
        )}
      </div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 16,
  right: 16,
  zIndex: 99999,
  background: '#1e293b',
  color: '#f1f5f9',
  padding: '12px 16px',
  borderRadius: 10,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontSize: 14,
  boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
};

const inputStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 6,
  border: '1px solid #475569',
  background: '#0f172a',
  color: '#e2e8f0',
  fontSize: 14,
  outline: 'none',
  width: 160,
};

const btnStyle: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 6,
  border: 'none',
  background: '#3b82f6',
  color: '#fff',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
};
