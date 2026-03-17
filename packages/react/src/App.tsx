import { useEffect, useRef, useState, useCallback } from 'react';
import { Replayer, EventType } from 'rrweb';
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

export function App({ createTransporter, bufferMs = 100 }: AppProps) {
  const [uid, setUid] = useState('');
  const [state, setState] = useState<string>('idle');
  const [isConnected, setIsConnected] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);
  const replayerRef = useRef<Replayer | null>(null);
  const serviceRef = useRef<ReturnType<typeof createAppService> | null>(null);
  const transporterRef = useRef<Transporter | null>(null);

  const connect = useCallback(() => {
    if (!uid.trim()) return;
    if (transporterRef.current) return;

    const transporter = createTransporter({ uid, role: 'app' });
    transporterRef.current = transporter;

    const buffer = new MirrorBuffer<eventWithTime>({
      bufferMs,
      onChunk({ data }) {
        replayerRef.current?.addEvent(data);
      },
    });

    const service = createAppService(() => {
      replayerRef.current?.pause();
      if (playerRef.current) playerRef.current.innerHTML = '';
      buffer.reset();
    });
    serviceRef.current = service;

    service.start();
    service.subscribe((s) => {
      const val = s.value as string;
      setState(val);
      setIsConnected(val === 'connected');
    });

    transporter.on(TransporterEvents.SourceReady, () => {
      // 현재 상태를 service에서 직접 확인 (stale closure 방지)
      if (!service.state.matches('idle')) return;

      service.send('SOURCE_READY');

      if (!playerRef.current) return;
      const replayer = new Replayer([], {
        root: playerRef.current,
        loadTimeout: 100,
        liveMode: true,
        insertStyleRules: [
          '.syncit-embed { display: none !important }',
        ],
        showWarning: false,
        showDebug: false,
        mouseTail: false,
      });
      replayerRef.current = replayer;
      transporter.sendStart();
    });

    transporter.on(TransporterEvents.SendRecord, (data) => {
      const { id, data: event, t } = (data as TransportSendRecordEvent).payload;

      // 현재 상태를 service에서 직접 확인 (stale closure 방지)
      if (!service.state.matches('connected')) {
        buffer.cursor = id - 1;
        replayerRef.current?.startLive(event.timestamp - bufferMs);
        service.send('FIRST_RECORD');
      }

      buffer.add({
        id,
        data: event,
        t,
      });
    });

    transporter.on(TransporterEvents.Stop, () => {
      service.send('STOP');
    });

    transporter.login().then(() => {
      transporter.sendMirrorReady();
    });
  }, [uid, createTransporter, bufferMs]);

  useEffect(() => {
    return () => {
      serviceRef.current?.stop();
    };
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.panel}>
        <div style={styles.header}>
          <span style={styles.dot(isConnected ? '#4ade80' : '#94a3b8')} />
          <span style={styles.title}>Syncit Mirror</span>
        </div>

        {!transporterRef.current ? (
          <div style={styles.body}>
            <input
              type="text"
              placeholder="Enter UID to connect"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && connect()}
              style={styles.input}
            />
            <button onClick={connect} style={styles.connectBtn}>
              Connect
            </button>
          </div>
        ) : (
          <div style={styles.body}>
            <div style={styles.row}>
              <span style={styles.label}>UID</span>
              <code style={styles.uid}>{uid}</code>
            </div>
            <div style={styles.row}>
              <span style={styles.label}>Status</span>
              <span style={styles.status}>{state}</span>
            </div>
          </div>
        )}
      </div>

      <div ref={playerRef} style={styles.player} />
    </div>
  );
}

const styles: Record<string, any> = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  panel: {
    background: '#1e293b',
    borderRadius: 12,
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    color: '#f1f5f9',
    minWidth: 300,
    overflow: 'hidden',
    marginBottom: 16,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 16px',
    borderBottom: '1px solid #334155',
  },
  dot: (color: string) => ({
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: color,
    display: 'inline-block',
  }),
  title: {
    fontWeight: 600,
    fontSize: 14,
  },
  body: {
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 12,
    color: '#94a3b8',
    minWidth: 40,
  },
  uid: {
    fontSize: 13,
    background: '#0f172a',
    padding: '4px 8px',
    borderRadius: 6,
    letterSpacing: 1,
  },
  status: {
    fontSize: 13,
    textTransform: 'capitalize' as const,
  },
  input: {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #475569',
    background: '#0f172a',
    color: '#e2e8f0',
    fontSize: 14,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  connectBtn: {
    padding: '8px 16px',
    borderRadius: 8,
    border: 'none',
    background: '#3b82f6',
    color: '#fff',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
  },
  player: {
    background: '#0f172a',
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 200,
  },
};
