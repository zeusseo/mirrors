import { useEffect, useRef, useState, useCallback } from 'react';
import { record, addCustomEvent } from 'rrweb';
import type { eventWithTime } from '@rrweb/types';
import {
  TransporterEvents,
  SourceBuffer,
  createEmbedService,
  CustomEventTags,
  type Transporter,
  type TransportAckRecordEvent,
  type FocusTargetPayload,
} from '@mirrors/core';
import { customAlphabet } from 'nanoid';
import { useElementPicker } from './useElementPicker';

const nanoid = customAlphabet('1234567890abcdef', 10);

/**
 * 요소에 대한 고유 CSS 셀렉터를 생성합니다.
 * nth-child 기반으로 유일성을 보장합니다.
 */
function getUniqueSelector(el: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;
  while (current && current !== document.documentElement && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      selector += `#${current.id}`;
      parts.unshift(selector);
      break; // ID는 고유하므로 여기서 종료
    }
    // nth-child 로 유일성 확보
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children);
      const idx = siblings.indexOf(current) + 1;
      selector += `:nth-child(${idx})`;
    }
    parts.unshift(selector);
    current = current.parentElement;
  }
  return parts.join(' > ');
}

/**
 * Live thumbnail that clones the picked element into a scaled-down preview.
 * Updates on DOM mutations and every 500ms to stay "live".
 */
function LiveThumbnail({ element }: { element: Element }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !element) return;

    const THUMB_W = 220;

    const refresh = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const scale = THUMB_W / rect.width;
      const thumbH = rect.height * scale;

      // Clone the element subtree
      const clone = element.cloneNode(true) as HTMLElement;
      clone.style.width = `${rect.width}px`;
      clone.style.height = `${rect.height}px`;
      clone.style.transformOrigin = 'top left';
      clone.style.transform = `scale(${scale})`;
      clone.style.pointerEvents = 'none';
      clone.style.margin = '0';

      container.style.width = `${THUMB_W}px`;
      container.style.height = `${Math.min(thumbH, 140)}px`;
      container.innerHTML = '';
      container.appendChild(clone);
    };

    refresh();

    // Re-clone on DOM mutations inside the element
    const mo = new MutationObserver(refresh);
    mo.observe(element, { childList: true, subtree: true, attributes: true, characterData: true });

    // Periodic fallback for animations / timers
    const timer = setInterval(refresh, 500);

    return () => {
      mo.disconnect();
      clearInterval(timer);
    };
  }, [element]);

  return (
    <div
      ref={containerRef}
      style={{
        overflow: 'hidden',
        borderRadius: 8,
        border: '1px solid #334155',
        background: '#0f172a',
        marginTop: 4,
      }}
    />
  );
}

interface EmbedProps {
  createTransporter: (opts: { role: string; uid: string }) => Transporter;
}

export function Embed({ createTransporter }: EmbedProps) {
  const [uid] = useState(() => nanoid());
  const [state, setState] = useState<string>('idle');
  const serviceRef = useRef<ReturnType<typeof createEmbedService> | null>(null);
  const { pickedEl, picking, startPicking, clearPicked } = useElementPicker();

  // Pending focus selector — set when element is picked but recording not yet active.
  // Will be sent as a custom event once recording starts (state becomes 'connected').
  const pendingFocusSelectorRef = useRef<string | null>(null);
  const isConnectedRef = useRef(false);

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
      const val = s.value as string;
      setState(val);
      isConnectedRef.current = val === 'connected';

      // When recording becomes active, send any pending focus target
      if (val === 'connected' && pendingFocusSelectorRef.current) {
        try {
          addCustomEvent(CustomEventTags.FocusTarget, {
            selector: pendingFocusSelectorRef.current,
          } as FocusTargetPayload);
          console.log('[Embed] Sent pending FocusTarget:', pendingFocusSelectorRef.current);
        } catch (e) {
          console.warn('[Embed] Failed to send pending FocusTarget:', e);
        }
      }
    });

    transporter.login().then(() => {
      console.log('[Embed] login complete, sending START');
      service.send('START');
    });

    transporter.on(TransporterEvents.MirrorReady, () => {
      console.log('[Embed] MirrorReady received, sending SourceReady');
      transporter.sendSourceReady();
    });
    transporter.on(TransporterEvents.Start, () => {
      console.log('[Embed] Start received, state:', service.state.value);
      if (service.state.matches('connected')) {
        service.send('RECONNECT');
      } else {
        service.send('CONNECT');
      }
      console.log('[Embed] after CONNECT, state:', service.state.value);
    });
    transporter.on(TransporterEvents.AckRecord, ({ payload }) => {
      buffer.delete(payload as TransportAckRecordEvent['payload']);
    });

    return () => {
      service.stop();
      isConnectedRef.current = false;
    };
  }, [uid, createTransporter]);

  // Send FocusTarget / ClearFocusTarget custom events when pickedEl changes
  useEffect(() => {
    if (pickedEl) {
      const selector = getUniqueSelector(pickedEl);
      pendingFocusSelectorRef.current = selector;

      if (isConnectedRef.current) {
        try {
          addCustomEvent(CustomEventTags.FocusTarget, { selector } as FocusTargetPayload);
          console.log('[Embed] FocusTarget sent:', selector);
        } catch (e) {
          console.warn('[Embed] FocusTarget deferred (recording not active):', e);
        }
      } else {
        console.log('[Embed] FocusTarget deferred (not connected yet):', selector);
      }
    } else {
      pendingFocusSelectorRef.current = null;

      if (isConnectedRef.current) {
        try {
          addCustomEvent(CustomEventTags.ClearFocusTarget, {});
          console.log('[Embed] ClearFocusTarget sent');
        } catch (e) {
          console.warn('[Embed] ClearFocusTarget failed:', e);
        }
      }
    }
  }, [pickedEl]);

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
    <div style={styles.container} data-mirrors-panel>
      <div style={styles.panel}>
        <div style={styles.header}>
          <span style={styles.dot(state === 'connected' ? '#4ade80' : state === 'ready' ? '#fbbf24' : '#94a3b8')} />
          <span style={styles.title}>Mirrors Embed</span>
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

          {/* ── Element Picker ── */}
          <div style={styles.divider} />
          {pickedEl ? (
            <>
              <div style={styles.row}>
                <span style={styles.label}>Target</span>
                <button onClick={clearPicked} style={styles.clearBtn}>✕ Clear</button>
              </div>
              <LiveThumbnail element={pickedEl} />
            </>
          ) : (
            <div style={styles.row}>
              <span style={styles.label}>Target</span>
              <span style={styles.targetAll}>전체 페이지</span>
            </div>
          )}
          <div style={styles.row}>
            <button
              onClick={startPicking}
              disabled={picking}
              style={{
                ...styles.pickerBtn,
                ...(picking ? styles.pickerBtnActive : {}),
              }}
            >
              {picking ? '🎯 요소를 클릭하세요…' : '🎯 Select Element'}
            </button>
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
  divider: {
    borderTop: '1px solid #334155',
    margin: '4px 0',
  },
  targetAll: {
    fontSize: 13,
    color: '#64748b',
    fontStyle: 'italic' as const,
  },
  pickedLabel: {
    fontSize: 12,
    background: '#0f172a',
    padding: '3px 8px',
    borderRadius: 6,
    color: '#60a5fa',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  clearBtn: {
    fontSize: 12,
    padding: '2px 8px',
    borderRadius: 6,
    border: '1px solid #475569',
    background: '#334155',
    color: '#ef4444',
    cursor: 'pointer',
  },
  pickerBtn: {
    flex: 1,
    padding: '6px 12px',
    borderRadius: 8,
    border: '1px solid #475569',
    background: '#334155',
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  pickerBtnActive: {
    background: 'rgba(59, 130, 246, 0.2)',
    borderColor: '#3b82f6',
    color: '#60a5fa',
    cursor: 'default',
  },
};
