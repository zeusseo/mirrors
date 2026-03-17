import { useEffect, useRef, useState, useCallback } from 'react';
import { record } from 'rrweb';
import type { eventWithTime } from '@rrweb/types';
import {
  TransporterEvents,
  SourceBuffer,
  createEmbedService,
  type Transporter,
  type TransportAckRecordEvent,
} from '@syncit/core';
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('1234567890abcdef', 10);

interface EmbedProps {
  createTransporter: (opts: { role: string; uid: string }) => Transporter;
}

export function Embed({ createTransporter }: EmbedProps) {
  const [uid] = useState(() => nanoid());
  const [state, setState] = useState<string>('idle');
  const serviceRef = useRef<ReturnType<typeof createEmbedService> | null>(null);

  useEffect(() => {
    const transporter = createTransporter({ uid, role: 'embed' });

    const buffer = new SourceBuffer<eventWithTime>({
      onTimeout(rec) {
        transporter.sendRecord(rec);
      },
    });

    const service = createEmbedService({
      transporter,
      record,
      stopRecordFn: null,
      buffer,
    });
    serviceRef.current = service;

    service.start();
    service.subscribe((s) => {
      setState(s.value as string);
    });

    // Embed 상태 머신: idle → START → ready → CONNECT → connected
    // login 성공 후 바로 START를 보내서 ready 상태로 전환
    transporter.login().then(() => {
      service.send('START');
    });

    transporter.on(TransporterEvents.MirrorReady, () => {
      transporter.sendSourceReady();
    });
    transporter.on(TransporterEvents.Start, () => {
      if (service.state.matches('connected')) {
        service.send('RECONNECT');
      } else {
        service.send('CONNECT');
      }
    });
    transporter.on(TransporterEvents.AckRecord, ({ payload }) => {
      buffer.delete(payload as TransportAckRecordEvent['payload']);
    });

    return () => {
      service.stop();
    };
  }, [uid, createTransporter]);

  const copyUid = useCallback(() => {
    navigator.clipboard.writeText(uid).catch(() => {
      const el = document.createElement('textarea');
      el.value = uid;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    });
  }, [uid]);

  return (
    <div style={styles.container}>
      <div style={styles.panel}>
        <div style={styles.header}>
          <span style={styles.dot(state === 'connected' ? '#4ade80' : state === 'ready' ? '#fbbf24' : '#94a3b8')} />
          <span style={styles.title}>Syncit Embed</span>
        </div>
        <div style={styles.body}>
          <div style={styles.row}>
            <span style={styles.label}>UID</span>
            <code style={styles.uid}>{uid}</code>
            <button onClick={copyUid} style={styles.copyBtn}>Copy</button>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Status</span>
            <span style={styles.status}>{state}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, any> = {
  container: {
    position: 'fixed' as const,
    bottom: 24,
    right: 24,
    zIndex: 99999,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  panel: {
    background: '#1e293b',
    borderRadius: 12,
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    color: '#f1f5f9',
    minWidth: 260,
    overflow: 'hidden',
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
    flex: 1,
  },
  copyBtn: {
    fontSize: 12,
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid #475569',
    background: '#334155',
    color: '#e2e8f0',
    cursor: 'pointer',
  },
  status: {
    fontSize: 13,
    textTransform: 'capitalize' as const,
  },
};
