import { useState, useEffect, useRef } from 'react';

type AnimationType = 'rotate' | 'bounce' | 'pulse' | 'fadeInOut';

interface AnimationOptions {
  /** 한 사이클 지속 시간 (ms). 기본값: 1000 */
  duration?: number;
  /** 애니메이션 일시정지 여부 */
  paused?: boolean;
}

/**
 * rrweb 미러에서도 동작하는 애니메이션 훅.
 *
 * CSS `@keyframes`는 rrweb replayer iframe에서 재생되지 않으므로,
 * JS 기반 inline style 변경으로 애니메이션을 구현합니다.
 * rrweb은 inline style 변경을 DOM mutation으로 캡처합니다.
 *
 * @example
 * ```tsx
 * const spinStyle = useMirrorSafeAnimation('rotate', { duration: 800 });
 * return <div style={{ width: 40, height: 40, ...spinStyle }} />;
 * ```
 */
export function useMirrorSafeAnimation(
  type: AnimationType,
  options: AnimationOptions = {},
): React.CSSProperties {
  const { duration = 1000, paused = false } = options;
  const [progress, setProgress] = useState(0);
  const dirRef = useRef(1);

  useEffect(() => {
    if (paused) return;

    const fps = 30;
    const interval = 1000 / fps;
    const step = interval / duration;

    const id = setInterval(() => {
      setProgress((p) => {
        if (type === 'bounce' || type === 'fadeInOut') {
          // ping-pong: 0 → 1 → 0
          const next = p + dirRef.current * step;
          if (next >= 1) { dirRef.current = -1; return 1; }
          if (next <= 0) { dirRef.current = 1; return 0; }
          return next;
        }
        // rotate, pulse: 0 → 1 (loop)
        return (p + step) % 1;
      });
    }, interval);

    return () => clearInterval(id);
  }, [type, duration, paused]);

  switch (type) {
    case 'rotate':
      return { transform: `rotate(${Math.round(progress * 360)}deg)` };
    case 'bounce': {
      const y = Math.sin(progress * Math.PI) * 14;
      return { transform: `translateY(-${y.toFixed(1)}px)` };
    }
    case 'pulse': {
      const scale = 1 + Math.sin(progress * Math.PI * 2) * 0.15;
      return { transform: `scale(${scale.toFixed(3)})` };
    }
    case 'fadeInOut': {
      const opacity = 0.3 + progress * 0.7;
      return { opacity };
    }
    default:
      return {};
  }
}
