import { useState, useEffect, useCallback, useRef } from 'react';

export interface ElementPickerResult {
  /** 현재 선택된 요소 */
  pickedEl: Element | null;
  /** picker 활성 여부 */
  picking: boolean;
  /** picker 시작 */
  startPicking: () => void;
  /** 선택 해제 (전체 페이지 미러링으로 복귀) */
  clearPicked: () => void;
  /** 선택된 요소의 간단한 설명 (예: "div#app" / "section.card") */
  pickedLabel: string;
}

const OVERLAY_ID = '__mirrors_picker_overlay__';
const PANEL_ATTR = 'data-mirrors-panel';

/** 요소의 간단한 CSS-like 라벨 생성 */
function describeElement(el: Element): string {
  let label = el.tagName.toLowerCase();
  if (el.id) label += `#${el.id}`;
  const cls = Array.from(el.classList).slice(0, 2).join('.');
  if (cls) label += `.${cls}`;
  return label;
}

/**
 * 브라우저 DevTools 스타일의 Element Picker hook.
 *
 * - hover 시 파란 반투명 오버레이로 하이라이트
 * - 클릭 시 해당 Element 를 반환하고 picker 종료
 * - ESC 로 취소
 * - `[data-mirrors-panel]` 요소는 선택 대상에서 제외
 */
export function useElementPicker(): ElementPickerResult {
  const [pickedEl, setPickedEl] = useState<Element | null>(null);
  const [picking, setPicking] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const hoveredRef = useRef<Element | null>(null);

  // ── 오버레이 DOM 생성 / 정리 ──
  useEffect(() => {
    if (!picking) {
      // cleanup
      const existing = document.getElementById(OVERLAY_ID);
      existing?.remove();
      overlayRef.current = null;
      return;
    }

    // 오버레이 생성
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    Object.assign(overlay.style, {
      position: 'fixed',
      pointerEvents: 'none',
      zIndex: '2147483647',
      background: 'rgba(59, 130, 246, 0.2)',
      border: '2px solid rgba(59, 130, 246, 0.7)',
      borderRadius: '4px',
      transition: 'all 0.1s ease',
      display: 'none',
    } as CSSStyleDeclaration);
    document.body.appendChild(overlay);
    overlayRef.current = overlay;
    document.body.style.cursor = 'crosshair';

    return () => {
      overlay.remove();
      overlayRef.current = null;
      document.body.style.cursor = '';
    };
  }, [picking]);

  // ── 이벤트 리스너 ──
  useEffect(() => {
    if (!picking) return;

    const isMirrorsPanel = (el: Element | null): boolean => {
      if (!el) return false;
      return !!el.closest(`[${PANEL_ATTR}]`);
    };

    const onMouseMove = (e: MouseEvent) => {
      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (!target || isMirrorsPanel(target)) {
        if (overlayRef.current) overlayRef.current.style.display = 'none';
        hoveredRef.current = null;
        return;
      }

      hoveredRef.current = target;
      const rect = target.getBoundingClientRect();
      const overlay = overlayRef.current;
      if (overlay) {
        overlay.style.display = 'block';
        overlay.style.top = `${rect.top}px`;
        overlay.style.left = `${rect.left}px`;
        overlay.style.width = `${rect.width}px`;
        overlay.style.height = `${rect.height}px`;
      }
    };

    const onClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const target = hoveredRef.current;
      if (!target || isMirrorsPanel(target)) return;

      setPickedEl(target);
      setPicking(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPicking(false);
      }
    };

    // capture phase 로 등록하여 다른 클릭 핸들러보다 먼저 실행
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [picking]);

  const startPicking = useCallback(() => {
    setPicking(true);
  }, []);

  const clearPicked = useCallback(() => {
    setPickedEl(null);
  }, []);

  const pickedLabel = pickedEl ? describeElement(pickedEl) : '';

  return { pickedEl, picking, startPicking, clearPicked, pickedLabel };
}
