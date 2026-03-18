import {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useCallback,
  type CSSProperties,
} from 'react';
import { addCustomEvent } from 'rrweb';
import { CustomEventTags } from '@mirrors/core';

/* ── Types ── */

export interface CanvasHandle {
  startLine(): void;
  endLine(): void;
  setPoints(points: number[]): void;
  highlight(left: number, top: number): void;
}

interface CanvasProps {
  role?: 'master' | 'slave';
  mode: string;        // 'brush' | 'eraser' | 'highlight'
  stroke: string;      // CSS color
  strokeWidth: number;
}

/* ── Styles ── */

const containerStyle: CSSProperties = {
  position: 'fixed',
  left: 0,
  top: 0,
  right: 0,
  bottom: 0,
  zIndex: 99990,
  pointerEvents: 'auto',
};

const canvasStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
};

/* ── Highlight keyframes (injected once) ── */
let highlightInjected = false;
function injectHighlightKeyframes() {
  if (highlightInjected) return;
  highlightInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes mirrors-highlight {
      0%   { transform: scale(1);   opacity: 0.5; }
      75%  { transform: scale(1.5); opacity: 1;   }
      100% { transform: scale(1);   opacity: 0.5; }
    }
  `;
  document.head.appendChild(style);
}

/* ── Component ── */

/**
 * 네이티브 Canvas 2D API 기반 화이트보드 컴포넌트.
 *
 * - role="master": 마우스 입력을 받아 직접 그리고, rrweb CustomEvent를 발행
 * - role="slave":  외부에서 imperative API로만 그림 (App 측에서 사용)
 */
export const Canvas = forwardRef<CanvasHandle, CanvasProps>(function Canvas(
  { role = 'master', mode, stroke, strokeWidth },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  // 드로잉 상태
  const isPaintingRef = useRef(false);
  const currentPointsRef = useRef<number[]>([]);

  // 모든 선 기록 (eraser 지원을 위해 전체 redraw 방식)
  const linesRef = useRef<
    Array<{
      points: number[];
      stroke: string;
      strokeWidth: number;
      compositeOp: GlobalCompositeOperation;
    }>
  >([]);

  // 최신 props를 ref로 유지 (이벤트 핸들러에서 참조)
  const propsRef = useRef({ mode, stroke, strokeWidth });
  propsRef.current = { mode, stroke, strokeWidth };

  const isLineMode = mode === 'brush' || mode === 'eraser';

  /* ── Canvas 초기화 ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 고해상도(Retina) 지원
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctxRef.current = ctx;

    // 리사이즈 처리
    const handleResize = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      ctx.scale(dpr, dpr);
      redrawAll();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── 전체 재그리기 ── */
  const redrawAll = useCallback(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    for (const line of linesRef.current) {
      drawLine(ctx, line.points, line.stroke, line.strokeWidth, line.compositeOp);
    }
  }, []);

  /* ── 단일 선 그리기 유틸 ── */
  function drawLine(
    ctx: CanvasRenderingContext2D,
    points: number[],
    lineStroke: string,
    lineWidth: number,
    compositeOp: GlobalCompositeOperation,
  ) {
    if (points.length < 2) return;

    ctx.save();
    ctx.globalCompositeOperation = compositeOp;
    ctx.strokeStyle = lineStroke;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) {
      ctx.lineTo(points[i], points[i + 1]);
    }
    ctx.stroke();
    ctx.restore();
  }

  /* ── Imperative API (slave에서 사용) ── */
  const startLineImpl = useCallback(() => {
    const { stroke: s, strokeWidth: sw, mode: m } = propsRef.current;
    isPaintingRef.current = true;
    currentPointsRef.current = [];
    linesRef.current.push({
      points: currentPointsRef.current,
      stroke: s,
      strokeWidth: sw,
      compositeOp: m === 'brush' ? 'source-over' : 'destination-out',
    });
  }, []);

  const endLineImpl = useCallback(() => {
    isPaintingRef.current = false;
  }, []);

  const setPointsImpl = useCallback(
    (points: number[]) => {
      if (linesRef.current.length === 0) return;
      const lastLine = linesRef.current[linesRef.current.length - 1];
      lastLine.points = points;
      currentPointsRef.current = points;
      redrawAll();
    },
    [redrawAll],
  );

  const highlightImpl = useCallback(
    (left: number, top: number) => {
      injectHighlightKeyframes();
      const container = containerRef.current;
      if (!container) return;

      const { stroke: s, strokeWidth: sw } = propsRef.current;
      const el = document.createElement('div');
      Object.assign(el.style, {
        position: 'absolute',
        left: `${left}px`,
        top: `${top}px`,
        background: s,
        width: `${2 * sw}px`,
        height: `${2 * sw}px`,
        borderRadius: `${sw}px`,
        animation: 'mirrors-highlight 1000ms ease-out',
        pointerEvents: 'none',
      });
      container.appendChild(el);
      setTimeout(() => {
        if (container.contains(el)) {
          container.removeChild(el);
        }
      }, 1000);
    },
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      startLine: startLineImpl,
      endLine: endLineImpl,
      setPoints: setPointsImpl,
      highlight: highlightImpl,
    }),
    [startLineImpl, endLineImpl, setPointsImpl, highlightImpl],
  );

  /* ── Master: 마우스/터치 이벤트 ── */
  useEffect(() => {
    if (role !== 'master') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const getPos = (e: MouseEvent | Touch): { x: number; y: number } => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onPointerDown = (e: MouseEvent) => {
      const { mode: m, stroke: s, strokeWidth: sw } = propsRef.current;
      const lineMode = m === 'brush' || m === 'eraser';

      if (lineMode) {
        const pos = getPos(e);
        isPaintingRef.current = true;
        currentPointsRef.current = [pos.x, pos.y];
        linesRef.current.push({
          points: currentPointsRef.current,
          stroke: s,
          strokeWidth: sw,
          compositeOp: m === 'brush' ? 'source-over' : 'destination-out',
        });
        addCustomEvent(CustomEventTags.StartLine, undefined);
      } else if (m === 'highlight') {
        highlightImpl(e.clientX - sw, e.clientY - sw);
        addCustomEvent(CustomEventTags.Highlight, {
          left: e.clientX - sw,
          top: e.clientY - sw,
        });
      }
    };

    const onPointerMove = (e: MouseEvent) => {
      const { mode: m } = propsRef.current;
      const lineMode = m === 'brush' || m === 'eraser';
      if (!lineMode || !isPaintingRef.current) return;

      const pos = getPos(e);
      currentPointsRef.current = [...currentPointsRef.current, pos.x, pos.y];

      if (linesRef.current.length > 0) {
        linesRef.current[linesRef.current.length - 1].points =
          currentPointsRef.current;
      }
      redrawAll();

      addCustomEvent(CustomEventTags.DrawLine, {
        points: currentPointsRef.current,
      });
    };

    const onPointerUp = () => {
      const { mode: m } = propsRef.current;
      const lineMode = m === 'brush' || m === 'eraser';
      if (!lineMode) return;

      isPaintingRef.current = false;
      addCustomEvent(CustomEventTags.EndLine, undefined);
    };

    // Touch → Mouse 변환
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      onPointerDown({
        clientX: touch.clientX,
        clientY: touch.clientY,
        ...getPos(touch),
      } as unknown as MouseEvent);
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      onPointerMove({
        clientX: touch.clientX,
        clientY: touch.clientY,
        ...getPos(touch),
      } as unknown as MouseEvent);
    };
    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      onPointerUp();
    };

    canvas.addEventListener('mousedown', onPointerDown);
    canvas.addEventListener('mousemove', onPointerMove);
    canvas.addEventListener('mouseup', onPointerUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);

    return () => {
      canvas.removeEventListener('mousedown', onPointerDown);
      canvas.removeEventListener('mousemove', onPointerMove);
      canvas.removeEventListener('mouseup', onPointerUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [role, redrawAll, highlightImpl]);

  return (
    <div ref={containerRef} style={containerStyle}>
      <canvas ref={canvasRef} style={canvasStyle} />
    </div>
  );
});
