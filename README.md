<p align="center">
  <img width="100px" height="100px" src="https://user-images.githubusercontent.com/13651389/79969148-a9c57280-84c3-11ea-9063-cb8066a12c66.png">
</p>

<h1 align="center">Mirrors</h1>

<p align="center">
  프라이버시 중심의 픽셀 퍼펙트 브라우저 코브라우징 — 실시간 화면 공유 & 원격 제어
</p>

<p align="center">
  <a href="https://github.com/rrweb-io/mirrors/blob/main/LICENSE"><img src="https://img.shields.io/github/license/rrweb-io/mirrors" alt="license"></a>
  <a href="https://www.npmjs.com/package/@mirrors/core"><img src="https://img.shields.io/npm/v/@mirrors/core" alt="npm version"></a>
</p>

---

> **⚠️ 초기 개발 단계**: Mirrors은 현재 활발히 개발 중이며, API가 예고 없이 변경될 수 있습니다. Issue를 통해 문의와 요청을 환영합니다.

## Mirrors이란?

**Mirrors** (_"sync it"_ 의 줄임말)은 [rrweb](https://github.com/rrweb-io/rrweb) 위에 구축된 브라우저 코브라우징 툴킷입니다.

- **픽셀 퍼펙트 화면 공유** — 영상이 아닌 DOM 스냅샷 + 증분 변경사항을 직렬화하여 전송. 낮은 대역폭, 화질 손실 없음.
- **원격 제어** — 뷰어가 공유자의 페이지에서 클릭, 스크롤, 입력 가능. 미러링된 DOM을 통해 동작.
- **프라이버시 보호** — 공유 시작 전 민감한 영역을 차단 지정. 차단된 영역은 캡처되지 않음.
- **협업 페인팅** — 브러시 / 지우개 / 하이라이트 모드의 실시간 드로잉 오버레이.
- **PDF 공유** — 세션 내에서 PDF 문서를 양측에 동기화 렌더링.
- **플러거블 전송 계층** — PeerJS, Agora RTM, WebSocket, LocalStorage 간 자유롭게 교체 가능.
- **다국어 지원** — 영어 및 중국어 로케일 내장.

---

## 아키텍처

Mirrors은 **Source (Embed) → Target (App)** 모델을 따릅니다. Source 측에서 rrweb으로 DOM 이벤트를 기록하고 Transporter를 통해 스트리밍하면, Target 측에서 샌드박스 iframe 내에서 이벤트를 재생합니다.

```
┌─────────────────────────────────────────────────────────┐
│                   Source (Embed, 공유자)                  │
│                                                         │
│  rrweb.record()  →  SourceBuffer  →  Transporter.send() │
│                       ↑ 재전송                            │
│                       └── onTimeout (미확인 청크 재전송)     │
└──────────────────────────┬──────────────────────────────┘
                           │  네트워크 (PeerJS / Agora / WS / LocalStorage)
┌──────────────────────────▼──────────────────────────────┐
│                   Target (App, 뷰어)                     │
│                                                         │
│  Transporter.on()  →  MirrorBuffer  →  rrweb.Replayer  │
│                      (재정렬 + 지연)                      │
│                                                         │
│  원격 제어:  click/scroll/input  →  Transporter          │
│                                  →  Source DOM           │
└─────────────────────────────────────────────────────────┘
```

### 상태 머신 (XState)

모든 생명주기 전환은 유한 상태 머신으로 모델링됩니다:

| 머신 | 상태 | 설명 |
|------|------|------|
| **AppService** | `idle → waiting_first_record → connected → stopped` | 뷰어 생명주기 |
| **AppControlService** | `not_control → requested → controlling` | 뷰어 측 원격 제어 |
| **EmbedService** | `idle → ready → connected` | 공유자 생명주기 |
| **EmbedControlService** | `not_control → requesting → controlled` | 공유자 측 원격 제어 |

---

## 모노레포 구조

**Lerna + Yarn Workspaces** 기반 모노레포로 3개의 패키지로 구성됩니다:

```
packages/
├── core/            # @mirrors/core — 버퍼, 상태 머신, 트랜스포터 인터페이스
├── transporter/     # @mirrors/transporter — 전송 계층 구현체
└── ui/              # @mirrors/ui — Svelte 컴포넌트 (App & Embed)
```

### `@mirrors/core` (v1.0.2)

프레임워크 독립적인 핵심 라이브러리입니다.

| 모듈 | 설명 |
|------|------|
| `buffer.ts` | `SourceBuffer` (송신 측, 타임아웃 시 재전송) 및 `MirrorBuffer` (수신 측, 순서 재정렬 후 순차 전달) |
| `machine.ts` | XState 상태 머신 — App / Embed / Control 생명주기 관리 |
| `transporter.ts` | `Transporter` 인터페이스 — 모든 전송 구현체가 따라야 할 계약 정의 |
| `common.ts` | 원격 제어 액션 (`Click`, `Scroll`, `Input`), rrweb `Mirror`를 통한 DOM 미러링, 포맷 유틸리티 |

**주요 의존성**: `rrweb`, `rrweb-snapshot`, `@rrweb/types`, `xstate`

### `@mirrors/transporter` (v1.0.2)

플러거블 전송 계층 구현체입니다.

| 트랜스포터 | 설명 | 옵션 |
|-----------|------|------|
| `LocalStorageTransporter` | `localStorage` 이벤트를 이용한 동일 브라우저 내 통신. 테스트 및 데모에 적합. | — |
| `PeerjsTransporter` | [PeerJS](https://peerjs.com/) 기반 WebRTC 데이터 채널. **1:N** (하나의 Embed → 다수 App) 브로드캐스트 지원. | `peerHost`, `peerPort`, `peerPath` |
| `AgoraRtmTransporter` | [Agora RTM](https://www.agora.io/en/real-time-messaging/) 클라우드 메시징. 대용량 페이로드의 자동 분할/재조립 처리. | `agoraAppId` |
| `WebSocketTransporter` | 표준 WebSocket. 연결 지연 시 자동 재시도. | `url` |

### `@mirrors/ui` (v1.0.2)

Svelte / SvelteKit UI 컴포넌트 및 데모 애플리케이션입니다.

| 컴포넌트 | 설명 |
|---------|------|
| `App.svelte` | **뷰어 / 코브라우저**. rrweb `Replayer`를 라이브 모드로 임베드. 지연시간 & 대역폭 차트(d3-scale) 표시. 원격 제어 요청/토글 지원. |
| `Embed.svelte` | **공유자 / 스트리머**. rrweb `record()` 시작, UID 생성(nanoid), 프라이버시 차단 영역 선택, 페인팅 도구, PDF 공유, 마우스 크기 조절, 원격 제어 수락 관리. |
| `Canvas.svelte` | [Konva](https://konvajs.org/) 기반 실시간 드로잉 오버레이. 브러시, 지우개, 하이라이트 모드 지원. |
| `PDF.svelte` | [pdf.js](https://mozilla.github.io/pdf.js/) 기반 세션 내 PDF 렌더링. |
| `LineChart.svelte` | d3-scale 기반 경량 SVG 라인 차트 (지연시간/대역폭 메트릭용). |
| `Panel.svelte` | 플로팅 패널 컨테이너. |
| `Icon.svelte` | SVG 아이콘 컴포넌트 (team, close, copy). |
| `Tag.svelte` | 차단 영역 표시용 제거 가능 태그 필. |

---

## 빠른 시작

### 사전 요구사항

- **Node.js** ≥ 16
- **Yarn** (Plug'n'Play)

### 의존성 설치

```bash
make install
# 또는
yarn install
```

### 빌드

```bash
make build          # core → transporter 순서로 빌드
make build-ui       # UI 패키지 빌드
```

### 개발 서버

```bash
# PeerJS 시그널링 서버 + Vite 개발 서버 동시 실행
make start

# 또는 개별 실행:
make peer           # PeerJS 서버 (포트 9000)
make dev            # Vite 개발 서버 (http://localhost:5173)
```

1. `http://localhost:5173` 접속 — Embed와 App 링크가 있는 랜딩 페이지.
2. `http://localhost:5173/embed/` 를 한 탭에서 열기 (**공유자**).
3. `http://localhost:5173/app/` 을 다른 탭에서 열기 (**뷰어**).
4. Embed 패널의 UID를 복사 → App의 UID 필드에 붙여넣기 → **Connect** 클릭.

### 서버 중지

```bash
make stop
```

---

## 라이브러리로 사용하기

패키지 설치:

```bash
npm install @mirrors/ui @mirrors/transporter
```

### Source 측 (Embed)

```js
import { Embed } from '@mirrors/ui';
import { PeerjsTransporter } from '@mirrors/transporter';

new Embed({
  target: document.body,
  props: {
    createTransporter({ role, uid }) {
      return new PeerjsTransporter({
        role,
        uid,
        peerHost: 'localhost',
        peerPort: 9000,
        peerPath: '/mirrors',
      });
    },
  },
});
```

### Target 측 (App)

```js
import { App } from '@mirrors/ui';
import { PeerjsTransporter } from '@mirrors/transporter';

new App({
  target: document.body,
  props: {
    createTransporter({ role, uid }) {
      return new PeerjsTransporter({
        role,
        uid,
        peerHost: 'localhost',
        peerPort: 9000,
        peerPath: '/mirrors',
      });
    },
  },
});
```

### LocalStorage 사용 (테스트용)

```js
import { LocalStorageTransporter } from '@mirrors/transporter';

// PeerjsTransporter 대신:
createTransporter({ role, uid }) {
  return new LocalStorageTransporter();
}
```

> 모든 트랜스포터 옵션에 대한 자세한 가이드는 [**guide.md**](./guide.md)를 참고하세요.

---

## Make 타겟 목록

| 명령어 | 설명 |
|--------|------|
| `make help` | 사용 가능한 모든 타겟 표시 |
| `make install` | 전체 의존성 설치 |
| `make build` | core + transporter 빌드 |
| `make build-ui` | UI 패키지 빌드 |
| `make dev` | Vite 개발 서버 시작 (포트 5173) |
| `make peer` | PeerJS 시그널링 서버 시작 (포트 9000) |
| `make start` | PeerJS + Vite 서버 동시 시작 |
| `make stop` | 모든 개발 서버 중지 |
| `make lint` | 전체 패키지 ESLint 실행 |
| `make check` | 전체 패키지 타입 체크 |
| `make test` | 전체 테스트 실행 |
| `make clean` | 빌드 산출물 제거 |
| `make rebuild` | 클린 + 빌드 |

---

## 테스트

```bash
make test               # 전체 테스트 (core + transporter + UI)
make test-core          # Core 단위 테스트 (Jest)
make test-transporter   # Transporter 단위 테스트 (Jest)
```

UI 패키지는 **Vitest**(단위 테스트)와 **Playwright**(E2E 테스트)를 사용합니다.

---

## 설계 문서

기술 설계에 대한 상세 문서:

- **English**: [docs/design.md](./docs/design.md)
- **中文**: [docs/design.zh_CN.md](./docs/design.zh_CN.md)

주요 설계 개념:

1. **버퍼 컴포넌트** — 네트워크 지터를 보상하기 위해 이벤트 재생을 ~1초 지연시키고, 순서가 뒤바뀐 이벤트를 재정렬하며, 누락된 청크를 감지하여 재전송 요청.
2. **트랜스포터 컴포넌트** — Source와 Target 사이의 추상 데이터 계층. `Transporter` 인터페이스를 구현하면 어떤 전송 메커니즘이든 연결 가능.
3. **원격 제어** — 샌드박스 리플레이 iframe 내의 사용자 상호작용을 감지하고, `{ action, id, ... }` 형태로 직렬화하여 rrweb DOM 미러를 통해 Source 측 DOM에 적용.

---

## 기술 스택

| 계층 | 기술 |
|------|------|
| DOM 기록 & 재생 | [rrweb](https://github.com/rrweb-io/rrweb) v2 (alpha) |
| 상태 관리 | [XState](https://xstate.js.org/) v4 |
| UI 프레임워크 | [Svelte](https://svelte.dev/) v3 + [SvelteKit](https://kit.svelte.dev/) v1 |
| 캔버스 드로잉 | [Konva](https://konvajs.org/) v7 |
| PDF 렌더링 | [pdf.js](https://mozilla.github.io/pdf.js/) v3 |
| 차트 | [d3-scale](https://github.com/d3/d3-scale) v3 |
| P2P 통신 | [PeerJS](https://peerjs.com/) v1 |
| 클라우드 메시징 | [Agora RTM SDK](https://www.agora.io/) |
| 빌드 (core/transporter) | [Rollup](https://rollupjs.org/) v2 |
| 빌드 (UI) | [Vite](https://vitejs.dev/) v4 |
| 모노레포 | [Lerna](https://lerna.js.org/) v3 + Yarn Workspaces |
| 테스트 | Jest, Vitest, Playwright |
| 언어 | TypeScript |

---

## 라이선스

[MIT](./LICENSE)

---

## 감사의 말

Mirrors은 오픈소스 웹 세션 녹화 라이브러리인 [rrweb](https://github.com/rrweb-io/rrweb) 위에 구축되었습니다.

원저자: **Yanzhen Yu** ([@nickseegoat](https://github.com/nickseegoat))
