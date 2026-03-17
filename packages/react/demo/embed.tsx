import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Embed } from '../src/Embed';
import { SocketIoTransporter } from '@syncit/transporter';

const RELAY_URL = 'http://localhost:3100';

function createTransporter({ uid, role }: { uid: string; role: string }) {
  return new SocketIoTransporter({ uid, role, url: RELAY_URL });
}

/* ───── 실시간 시계 ───── */
function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const fmt = (n: number) => String(n).padStart(2, '0');
  return (
    <div style={{ textAlign: 'center', marginBottom: 24 }}>
      <div style={{ fontSize: 56, fontWeight: 800, fontVariantNumeric: 'tabular-nums', background: 'linear-gradient(135deg, #60a5fa, #a78bfa, #f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        {fmt(now.getHours())}:{fmt(now.getMinutes())}:{fmt(now.getSeconds())}
      </div>
      <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 4 }}>
        {now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
      </div>
    </div>
  );
}

/* ───── 타이핑 애니메이션 ───── */
function TypingText({ texts }: { texts: string[] }) {
  const [idx, setIdx] = useState(0);
  const [chars, setChars] = useState(0);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    const text = texts[idx];
    const speed = deleting ? 40 : 80;
    if (!deleting && chars === text.length) {
      const t = setTimeout(() => setDeleting(true), 1800);
      return () => clearTimeout(t);
    }
    if (deleting && chars === 0) {
      setDeleting(false);
      setIdx((i) => (i + 1) % texts.length);
      return;
    }
    const t = setTimeout(() => setChars((c) => c + (deleting ? -1 : 1)), speed);
    return () => clearTimeout(t);
  }, [chars, deleting, idx, texts]);
  return (
    <div style={{ fontSize: 20, color: '#cbd5e1', textAlign: 'center', height: 32, marginBottom: 32 }}>
      {texts[idx].slice(0, chars)}<span style={{ borderRight: '2px solid #60a5fa', animation: 'blink 0.8s step-end infinite', marginLeft: 2 }} />
    </div>
  );
}

/* ───── 테마 변경 ───── */
const themes = [
  { name: '🌌 Galaxy', grad: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)' },
  { name: '🌅 Sunset', grad: 'linear-gradient(135deg, #1a1a2e, #e94560, #16213e)' },
  { name: '🌊 Ocean', grad: 'linear-gradient(135deg, #0f172a, #0ea5e9, #06b6d4)' },
  { name: '🌲 Forest', grad: 'linear-gradient(135deg, #0f172a, #059669, #10b981)' },
  { name: '🔥 Flame', grad: 'linear-gradient(135deg, #1a1a2e, #f97316, #ef4444)' },
];

/* ───── 카운터 + 프로그레스 ───── */
function Counter() {
  const [count, setCount] = useState(50);
  return (
    <div style={card}>
      <h3 style={cardTitle}>⚡ 카운터</h3>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, margin: '16px 0' }}>
        <button onClick={() => setCount((c) => Math.max(0, c - 10))} style={btnStyle}>-10</button>
        <button onClick={() => setCount((c) => Math.max(0, c - 1))} style={btnStyle}>-</button>
        <span style={{ fontSize: 36, fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 60, textAlign: 'center' }}>{count}</span>
        <button onClick={() => setCount((c) => Math.min(100, c + 1))} style={btnStyle}>+</button>
        <button onClick={() => setCount((c) => Math.min(100, c + 10))} style={btnStyle}>+10</button>
      </div>
      <div style={{ background: '#1e293b', borderRadius: 999, height: 12, overflow: 'hidden' }}>
        <div style={{ width: `${count}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)', transition: 'width 0.3s ease' }} />
      </div>
      <div style={{ textAlign: 'right', fontSize: 12, color: '#64748b', marginTop: 4 }}>{count}%</div>
    </div>
  );
}

/* ───── To-Do 리스트 ───── */
function TodoList() {
  const [items, setItems] = useState([
    { id: 1, text: 'Embed 페이지 열기', done: true },
    { id: 2, text: 'UID 복사하기', done: false },
    { id: 3, text: 'App 페이지에서 연결', done: false },
  ]);
  const [input, setInput] = useState('');
  const nextId = useRef(4);
  const add = () => {
    if (!input.trim()) return;
    setItems((p) => [...p, { id: nextId.current++, text: input.trim(), done: false }]);
    setInput('');
  };
  const toggle = (id: number) => setItems((p) => p.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  const remove = (id: number) => setItems((p) => p.filter((i) => i.id !== id));
  return (
    <div style={card}>
      <h3 style={cardTitle}>📝 To-Do</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="새 할일..." style={inputStyle} />
        <button onClick={add} style={{ ...btnStyle, background: '#10b981' }}>추가</button>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((item) => (
          <li key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #1e293b' }}>
            <input type="checkbox" checked={item.done} onChange={() => toggle(item.id)} style={{ width: 18, height: 18, accentColor: '#8b5cf6' }} />
            <span style={{ flex: 1, textDecoration: item.done ? 'line-through' : 'none', color: item.done ? '#475569' : '#e2e8f0', transition: 'all 0.2s' }}>{item.text}</span>
            <button onClick={() => remove(item.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───── 드래그 카드 ───── */
function DraggableCard() {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const offset = useRef({ x: 0, y: 0 });
  const onDown = useCallback((e: React.MouseEvent) => {
    setDragging(true);
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  }, [pos]);
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => setPos({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y });
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging]);
  return (
    <div
      onMouseDown={onDown}
      style={{
        ...card,
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        cursor: dragging ? 'grabbing' : 'grab',
        boxShadow: dragging ? '0 12px 40px rgba(139,92,246,0.4)' : card.boxShadow,
        transition: dragging ? 'none' : 'box-shadow 0.2s',
        userSelect: 'none',
        textAlign: 'center',
      }}
    >
      <h3 style={cardTitle}>🖱️ 드래그 해보세요</h3>
      <div style={{ fontSize: 12, color: '#64748b' }}>x: {pos.x.toFixed(0)}, y: {pos.y.toFixed(0)}</div>
      <div style={{ marginTop: 12, fontSize: 40 }}>📦</div>
    </div>
  );
}

/* ───── 애니메이션 위젯 ───── */
function AnimWidgets() {
  const [pulse, setPulse] = useState(false);
  return (
    <div style={card}>
      <h3 style={cardTitle}>✨ 애니메이션</h3>
      <div style={{ display: 'flex', gap: 24, alignItems: 'center', justifyContent: 'center', padding: '16px 0', flexWrap: 'wrap' }}>
        {/* 스피너 */}
        <div style={{ width: 40, height: 40, border: '4px solid #1e293b', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        {/* 펄스 버튼 */}
        <button
          onClick={() => { setPulse(true); setTimeout(() => setPulse(false), 600); }}
          style={{
            padding: '10px 20px', borderRadius: 999, border: 'none',
            background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', color: '#fff', fontWeight: 600,
            cursor: 'pointer', transform: pulse ? 'scale(1.2)' : 'scale(1)',
            transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        >
          {pulse ? '💥 Boom!' : '🎯 Click me'}
        </button>
        {/* 바운스 이모지 */}
        <div style={{ fontSize: 32, animation: 'bounce 1s ease infinite' }}>🚀</div>
        {/* 회전 이모지 */}
        <div style={{ fontSize: 32, animation: 'spin 3s linear infinite' }}>⚙️</div>
      </div>
    </div>
  );
}

/* ───── 컬러 슬라이더 ───── */
function ColorMixer() {
  const [r, setR] = useState(99);
  const [g, setG] = useState(102);
  const [b, setB] = useState(241);
  const color = `rgb(${r}, ${g}, ${b})`;
  return (
    <div style={card}>
      <h3 style={cardTitle}>🎨 컬러 믹서</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
        <div style={{ width: 60, height: 60, borderRadius: 12, background: color, boxShadow: `0 0 20px ${color}40`, transition: 'all 0.2s' }} />
        <div style={{ flex: 1 }}>
          <label style={sliderLabel}>R: {r}</label>
          <input type="range" min={0} max={255} value={r} onChange={(e) => setR(+e.target.value)} style={{ ...sliderStyle, accentColor: '#ef4444' }} />
          <label style={sliderLabel}>G: {g}</label>
          <input type="range" min={0} max={255} value={g} onChange={(e) => setG(+e.target.value)} style={{ ...sliderStyle, accentColor: '#22c55e' }} />
          <label style={sliderLabel}>B: {b}</label>
          <input type="range" min={0} max={255} value={b} onChange={(e) => setB(+e.target.value)} style={{ ...sliderStyle, accentColor: '#3b82f6' }} />
        </div>
      </div>
      <code style={{ fontSize: 12, color: '#64748b' }}>{color}</code>
    </div>
  );
}

/* ───── 팝업 / 모달 ───── */
function PopupDemo() {
  const [modal, setModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  return (
    <div style={card}>
      <h3 style={cardTitle}>🪟 팝업 / 모달</h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => setModal(true)} style={{ ...btnStyle, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
          📋 모달 열기
        </button>
        <button onClick={() => showToast('✅ 성공적으로 저장되었습니다!')} style={{ ...btnStyle, background: '#10b981' }}>
          🔔 토스트 알림
        </button>
        <button onClick={() => setConfirm(true)} style={{ ...btnStyle, background: '#f59e0b' }}>
          ❓ 확인 대화상자
        </button>
      </div>
      {result && <div style={{ marginTop: 8, fontSize: 13, color: '#94a3b8' }}>결과: {result}</div>}

      {/* 모달 오버레이 */}
      {modal && (
        <div style={overlayStyle} onClick={() => setModal(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: 20 }}>🎉 모달 팝업</h3>
            <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 16 }}>
              이 모달은 DOM 요소의 동적 추가/제거를 시연합니다.<br/>
              미러(App) 화면에서도 동일하게 보입니다!
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(false)} style={{ ...btnStyle, background: '#475569' }}>닫기</button>
              <button onClick={() => { setModal(false); showToast('🎯 확인 완료!'); }} style={{ ...btnStyle, background: '#3b82f6' }}>확인</button>
            </div>
          </div>
        </div>
      )}

      {/* 확인 대화상자 */}
      {confirm && (
        <div style={overlayStyle} onClick={() => { setConfirm(false); setResult('취소됨'); }}>
          <div style={{ ...modalStyle, maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>⚠️ 확인</h3>
            <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 16 }}>정말 이 작업을 수행하시겠습니까?</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setConfirm(false); setResult('취소됨 ❌'); }} style={{ ...btnStyle, background: '#475569' }}>취소</button>
              <button onClick={() => { setConfirm(false); setResult('승인됨 ✅'); showToast('✅ 승인 완료!'); }} style={{ ...btnStyle, background: '#ef4444' }}>승인</button>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 */}
      {toast && (
        <div style={toastStyle}>{toast}</div>
      )}
    </div>
  );
}

/* ───── 메인 페이지 ───── */
function EmbedPage() {
  const [themeIdx, setThemeIdx] = useState(0);
  return (
    <div style={{ minHeight: '100vh', background: themes[themeIdx].grad, transition: 'background 0.8s ease', padding: '40px 20px', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#f1f5f9' }}>
      {/* 글로벌 키프레임 */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
        @keyframes blink { 50% { opacity: 0 } }
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes bounce { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-14px) } }
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>

      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        {/* Hero */}
        <LiveClock />
        <TypingText texts={['실시간 화면 공유 데모 🎬', 'DOM 변경이 즉시 미러링됩니다 ⚡', '클릭, 입력, 드래그 모두 동기화 🔄', 'rrweb + Socket.IO 기반 🛠️']} />

        {/* 테마 변경 */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 32, flexWrap: 'wrap' }}>
          {themes.map((t, i) => (
            <button
              key={i}
              onClick={() => setThemeIdx(i)}
              style={{
                padding: '8px 16px', borderRadius: 999, border: i === themeIdx ? '2px solid #fff' : '2px solid transparent',
                background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', color: '#fff',
                fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              {t.name}
            </button>
          ))}
        </div>

        {/* 2-column grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <Counter />
          <ColorMixer />
          <TodoList />
          <AnimWidgets />
          <PopupDemo />
        </div>

        {/* 드래그 카드 */}
        <div style={{ marginTop: 16 }}>
          <DraggableCard />
        </div>
      </div>

      {/* Syncit Embed 패널 */}
      <Embed createTransporter={createTransporter} />
    </div>
  );
}

/* ───── 공통 스타일 ───── */
const card: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.6)',
  backdropFilter: 'blur(12px)',
  borderRadius: 16,
  padding: '20px 24px',
  border: '1px solid rgba(148, 163, 184, 0.1)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
};
const cardTitle: React.CSSProperties = {
  margin: '0 0 12px', fontSize: 16, fontWeight: 700,
};
const btnStyle: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 10, border: 'none',
  background: '#334155', color: '#e2e8f0', fontSize: 16,
  fontWeight: 600, cursor: 'pointer',
};
const inputStyle: React.CSSProperties = {
  flex: 1, padding: '8px 12px', borderRadius: 10,
  border: '1px solid #334155', background: '#0f172a',
  color: '#e2e8f0', fontSize: 14, outline: 'none',
};
const sliderLabel: React.CSSProperties = {
  fontSize: 11, color: '#64748b', display: 'block', marginTop: 4,
};
const sliderStyle: React.CSSProperties = {
  width: '100%', height: 4, cursor: 'pointer',
};
const overlayStyle: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 10000,
};
const modalStyle: React.CSSProperties = {
  background: '#1e293b', borderRadius: 16, padding: '24px 28px',
  maxWidth: 420, width: '90%', color: '#f1f5f9',
  boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
  border: '1px solid rgba(148,163,184,0.15)',
};
const toastStyle: React.CSSProperties = {
  position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
  background: '#1e293b', color: '#f1f5f9', padding: '12px 24px',
  borderRadius: 12, fontSize: 14, fontWeight: 600,
  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
  border: '1px solid rgba(148,163,184,0.15)',
  zIndex: 10001,
};

const root = createRoot(document.getElementById('root')!);
root.render(<EmbedPage />);
