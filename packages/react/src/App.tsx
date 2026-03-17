import { useEffect, useRef, useState, useCallback } from 'react';
import { Replayer } from 'rrweb';
import 'rrweb/dist/style.css';
import type { eventWithTime, customEvent } from '@rrweb/types';
import {
  TransporterEvents,
  MirrorBuffer,
  createAppService,
  CustomEventTags,
  type Transporter,
  type TransportSendRecordEvent,
  type FocusTargetPayload,
} from '@mirrors/core';

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
  const replayerRef = useRef<Replayer | null>(null);

  /**
   * FocusTarget 수신 시: Replayer iframe 내에서 해당 요소를 찾아
   * wrapper를 해당 요소의 크기/위치에 맞게 clip 합니다.
   */
  const applyFocusTarget = useCallback((selector: string) => {
    const replayer = replayerRef.current;
    if (!replayer) return;
    const iframe = replayer.iframe;
    const iframeDoc = iframe.contentDocument;
    if (!iframeDoc) return;

    const target = iframeDoc.querySelector(selector);
    if (!target) {
      console.warn('[App] FocusTarget element not found:', selector);
      return;
    }

    const rect = target.getBoundingClientRect();
    const wrapper = replayer.wrapper;

    // Wrapper 스타일: 선택된 요소 크기에 맞게 clip + translate
    wrapper.style.width = `${rect.width}px`;
    wrapper.style.height = `${rect.height}px`;
    wrapper.style.overflow = 'hidden';

    // iframe 을 wrapper 내에서 요소 위치만큼 이동시켜 해당 영역만 보이게 함
    iframe.style.position = 'absolute';
    iframe.style.left = `${-rect.left}px`;
    iframe.style.top = `${-rect.top}px`;

    console.log('[App] FocusTarget applied:', selector, rect);
  }, []);

  const clearFocusTarget = useCallback(() => {
    const replayer = replayerRef.current;
    if (!replayer) return;
    const wrapper = replayer.wrapper;

    // Reset wrapper & iframe to full-page view
    wrapper.style.width = '';
    wrapper.style.height = '';
    wrapper.style.overflow = '';
    replayer.iframe.style.position = '';
    replayer.iframe.style.left = '';
    replayer.iframe.style.top = '';

    console.log('[App] FocusTarget cleared');
  }, []);

  const connect = useCallback(() => {
    if (!uid.trim() || connectedRef.current) return;
    connectedRef.current = true;

    console.log('[App] connecting with uid:', uid);

    const transporter = createTransporter({ uid, role: 'app' });

    let replayer: Replayer | null = null;

    // Track focus selector to re-apply on subsequent events
    let focusSelector: string | null = null;

    const buffer = new MirrorBuffer<eventWithTime>({
      bufferMs,
      onChunk({ data }) {
        replayer?.addEvent(data);

        // Check for custom FocusTarget events
        if (data.type === 5 /* CustomEvent */) {
          const customData = (data as customEvent).data;
          if (customData.tag === CustomEventTags.FocusTarget) {
            focusSelector = (customData.payload as FocusTargetPayload).selector;
            // Defer to allow rrweb to process the event first
            requestAnimationFrame(() => applyFocusTarget(focusSelector!));
          } else if (customData.tag === CustomEventTags.ClearFocusTarget) {
            focusSelector = null;
            clearFocusTarget();
          }
        }

        // Re-apply focus on DOM mutation events (type 3 = IncrementalSnapshot)
        // to keep the clip position correct as the page changes
        if (focusSelector && data.type === 3) {
          requestAnimationFrame(() => applyFocusTarget(focusSelector!));
        }
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
          '.mirrors-embed { display: none !important }',
          // Hide the Embed panel in mirror view
          '[data-mirrors-panel] { display: none !important }',
          `.replayer-mouse {
            width: 40px !important;
            height: 40px !important;
            filter: drop-shadow(0 0 8px rgba(239, 68, 68, 0.8)) drop-shadow(0 0 20px rgba(239, 68, 68, 0.4));
          }`,
          `.replayer-mouse::after {
            width: 32px !important;
            height: 32px !important;
            background: rgba(239, 68, 68, 0.35) !important;
            border-radius: 50% !important;
            transform: translate(-50%, -50%) !important;
          }`,
        ],
        showWarning: false,
        showDebug: false,
        mouseTail: {
          strokeStyle: 'rgba(239, 68, 68, 0.5)',
          lineWidth: 3,
        },
      });
      replayerRef.current = replayer;

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
  }, [uid, createTransporter, bufferMs, applyFocusTarget, clearFocusTarget]);

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
