import type { RefObject } from 'react';
import { CustomEventTags } from '@mirrors/core';
import type { CanvasHandle } from './Canvas';

/**
 * Painting 설정 타입
 */
export interface PaintingConfig {
  stroke: string;
  strokeWidth: number;
  mode: string;
}

/**
 * 커스텀 이벤트 핸들러 콜백 인터페이스
 */
export interface CustomEventCallbacks {
  setPainting: (painting: boolean) => void;
  setPaintingConfig: (config: PaintingConfig) => void;
  canvasRef: RefObject<CanvasHandle | null>;
}

/**
 * rrweb 커스텀 이벤트(type=5)를 처리하는 공통 함수.
 * App.tsx (실시간)과 Player.tsx (녹화 재생) 양쪽에서 사용.
 */
export function handlePaintingEvent(
  tag: string,
  payload: unknown,
  callbacks: CustomEventCallbacks,
): boolean {
  const { setPainting, setPaintingConfig, canvasRef } = callbacks;

  switch (tag) {
    case CustomEventTags.StartPaint:
      setPainting(true);
      return true;

    case CustomEventTags.EndPaint:
      setPainting(false);
      return true;

    case CustomEventTags.SetPaintingConfig:
      setPaintingConfig((payload as { config: PaintingConfig }).config);
      return true;

    case CustomEventTags.StartLine:
      requestAnimationFrame(() => canvasRef.current?.startLine());
      return true;

    case CustomEventTags.EndLine:
      canvasRef.current?.endLine();
      return true;

    case CustomEventTags.DrawLine:
      canvasRef.current?.setPoints((payload as { points: number[] }).points);
      return true;

    case CustomEventTags.Highlight:
      canvasRef.current?.highlight(
        (payload as { left: number; top: number }).left,
        (payload as { left: number; top: number }).top,
      );
      return true;

    default:
      return false;
  }
}
