import { useEffect, useRef, useState, useCallback } from 'react';
import { Replayer } from 'rrweb';
import 'rrweb/dist/style.css';
import type { eventWithTime } from '@rrweb/types';
import { Canvas, type CanvasHandle } from './Canvas';
import {
  handlePaintingEvent,
  type PaintingConfig,
} from './useCustomEventHandler';

export interface PlayerProps {
  /** REST API base URL, e.g. 'http://localhost:3100' */
  apiUrl: string;
}

interface SessionInfo {
  uid: string;
  started: number;
  ended: number | null;
  eventCount: number;
}

/**
 * 녹화된 세션을 재생하는 컴포넌트.
 * 세션 목록을 로드하여 선택 후, rrweb Replayer로 재생합니다.
 */
export function Player({ apiUrl }: PlayerProps) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [playState, setPlayState] = useState<'idle' | 'playing' | 'paused'>(
    'idle',
  );
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const playerRef = useRef<HTMLDivElement>(null);
  const replayerRef = useRef<Replayer | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Painting (Canvas overlay for whiteboard replay)
  const [painting, setPainting] = useState(false);
  const [paintingConfig, setPaintingConfig] = useState<PaintingConfig>({
    stroke: '#df4b26',
    strokeWidth: 5,
    mode: 'brush',
  });
  const canvasRef = useRef<CanvasHandle>(null);

  // Load session list
  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/sessions`);
      const data = (await res.json()) as SessionInfo[];
      setSessions(data);
    } catch (err) {
      console.error('[Player] failed to load sessions:', err);
    }
  }, [apiUrl]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  // Clean up replayer and timer
  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    replayerRef.current?.destroy();
    replayerRef.current = null;
    if (playerRef.current) playerRef.current.innerHTML = '';
    setPlayState('idle');
    setProgress(0);
    setDuration(0);
    setPainting(false);
  }, []);

  // Load and play a session
  const playSession = useCallback(
    async (uid: string) => {
      cleanup();
      setSelectedUid(uid);
      setLoading(true);

      try {
        const res = await fetch(`${apiUrl}/api/sessions/${uid}`);
        const { events } = (await res.json()) as {
          session: SessionInfo;
          events: eventWithTime[];
        };

        if (!events.length || !playerRef.current) {
          setLoading(false);
          return;
        }

        const replayer = new Replayer(events, {
          root: playerRef.current,
          UNSAFE_replayCanvas: true,
          insertStyleRules: [
            '.mirrors-embed { display: none !important }',
            '[data-mirrors-panel] { display: none !important }',
          ],
          showWarning: false,
          showDebug: false,
          mouseTail: {
            strokeStyle: 'rgba(239, 68, 68, 0.5)',
            lineWidth: 3,
          },
        });

        replayerRef.current = replayer;

        // Handle custom events (whiteboard etc.)
        replayer.on('custom-event', (event: unknown) => {
          const evt = event as { data: { tag: string; payload?: unknown } };
          handlePaintingEvent(evt.data.tag, evt.data.payload, {
            setPainting,
            setPaintingConfig,
            canvasRef,
          });
        });

        // Calculate duration
        const totalDuration =
          events[events.length - 1].timestamp - events[0].timestamp;
        setDuration(totalDuration);

        // Progress tracking
        timerRef.current = setInterval(() => {
          const timer = replayer.getMetaData();
          if (timer) {
            const current = replayer.getCurrentTime();
            setProgress(current);
            // Auto-stop at the end
            if (current >= totalDuration) {
              setPlayState('paused');
              if (timerRef.current) clearInterval(timerRef.current);
            }
          }
        }, 200);

        replayer.play();
        setPlayState('playing');
        setLoading(false);
      } catch (err) {
        console.error('[Player] failed to load session:', err);
        setLoading(false);
      }
    },
    [apiUrl, cleanup],
  );

  const togglePlay = useCallback(() => {
    const replayer = replayerRef.current;
    if (!replayer) return;

    if (playState === 'playing') {
      replayer.pause();
      setPlayState('paused');
    } else {
      replayer.resume();
      setPlayState('playing');
    }
  }, [playState]);

  const seekTo = useCallback((ms: number) => {
    const replayer = replayerRef.current;
    if (!replayer) return;
    replayer.pause(ms);
    setProgress(ms);
    setPlayState('paused');
  }, []);

  const deleteSession = useCallback(
    async (uid: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm('세션을 삭제하시겠습니까?')) return;
      try {
        await fetch(`${apiUrl}/api/sessions/${uid}`, { method: 'DELETE' });
        if (selectedUid === uid) cleanup();
        void loadSessions();
      } catch (err) {
        console.error('[Player] delete failed:', err);
      }
    },
    [apiUrl, selectedUid, cleanup, loadSessions],
  );

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  };

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleString('ko-KR', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div style={styles.container}>
      {/* Sidebar: Session List */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h3 style={styles.sidebarTitle}>📹 녹화 목록</h3>
          <button onClick={() => void loadSessions()} style={styles.refreshBtn}>
            ↻
          </button>
        </div>
        {sessions.length === 0 ? (
          <p style={styles.emptyText}>녹화된 세션이 없습니다</p>
        ) : (
          sessions.map((s) => (
            <div
              key={s.uid}
              onClick={() => void playSession(s.uid)}
              style={{
                ...styles.sessionItem,
                ...(selectedUid === s.uid ? styles.sessionItemActive : {}),
              }}
            >
              <div style={styles.sessionUid}>{s.uid}</div>
              <div style={styles.sessionMeta}>
                {formatDate(s.started)} · {s.eventCount} events
                {s.ended && ` · ${formatTime(s.ended - s.started)}`}
              </div>
              <button
                onClick={(e) => void deleteSession(s.uid, e)}
                style={styles.deleteBtn}
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      {/* Main: Player */}
      <div style={styles.main}>
        <div ref={playerRef} style={styles.playerArea} />

        {/* Canvas overlay for whiteboard replay */}
        {painting && (
          <Canvas
            ref={canvasRef}
            role="slave"
            mode={paintingConfig.mode}
            stroke={paintingConfig.stroke}
            strokeWidth={paintingConfig.strokeWidth}
          />
        )}

        {/* Controls */}
        {selectedUid && (
          <div style={styles.controls}>
            <button onClick={togglePlay} style={styles.playBtn}>
              {playState === 'playing' ? '⏸' : '▶'}
            </button>
            <span style={styles.timeText}>{formatTime(progress)}</span>
            <input
              type="range"
              min={0}
              max={duration}
              value={progress}
              onChange={(e) => seekTo(Number(e.target.value))}
              style={styles.seeker}
            />
            <span style={styles.timeText}>{formatTime(duration)}</span>
          </div>
        )}

        {loading && <div style={styles.loadingOverlay}>로딩 중…</div>}

        {!selectedUid && !loading && (
          <div style={styles.placeholder}>
            ← 왼쪽에서 세션을 선택하세요
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    height: '100vh',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    background: '#0f172a',
    color: '#f1f5f9',
  },
  sidebar: {
    width: 280,
    background: '#1e293b',
    borderRight: '1px solid #334155',
    overflowY: 'auto',
    flexShrink: 0,
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px',
    borderBottom: '1px solid #334155',
  },
  sidebarTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
  },
  refreshBtn: {
    background: 'none',
    border: '1px solid #475569',
    color: '#94a3b8',
    borderRadius: 6,
    padding: '4px 8px',
    cursor: 'pointer',
    fontSize: 16,
  },
  emptyText: {
    padding: 16,
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
  },
  sessionItem: {
    position: 'relative',
    padding: '12px 16px',
    borderBottom: '1px solid #334155',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  sessionItemActive: {
    background: 'rgba(59, 130, 246, 0.15)',
    borderLeft: '3px solid #3b82f6',
  },
  sessionUid: {
    fontSize: 13,
    fontFamily: 'monospace',
    color: '#e2e8f0',
    marginBottom: 4,
  },
  sessionMeta: {
    fontSize: 11,
    color: '#94a3b8',
  },
  deleteBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    background: 'none',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: 14,
    padding: '2px 6px',
    borderRadius: 4,
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
  },
  playerArea: {
    flex: 1,
    overflow: 'auto',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    background: '#1e293b',
    borderTop: '1px solid #334155',
  },
  playBtn: {
    background: '#3b82f6',
    border: 'none',
    color: '#fff',
    borderRadius: 8,
    padding: '8px 14px',
    cursor: 'pointer',
    fontSize: 16,
    fontWeight: 600,
  },
  timeText: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: 'monospace',
    minWidth: 40,
  },
  seeker: {
    flex: 1,
    cursor: 'pointer',
    accentColor: '#3b82f6',
  },
  loadingOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(15, 23, 42, 0.8)',
    fontSize: 18,
    color: '#94a3b8',
  },
  placeholder: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    color: '#475569',
  },
};
