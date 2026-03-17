# Guide

**Currently, Mirrors is at an early development stage. During this stage, API could be changed frequently.**

## Quick Start

Using Mirrors needs `@mirrors/ui` and `@mirrors/transporter`:

```
npm i @mirrors/ui @mirrors/transporter
```

Import Mirrors and use the LocalStorageTransporter：

```js
import mirrors from '@mirrors/ui';
import '@mirrors/ui/dist/style.css';
import { LocalStorageTransporter } from '@mirrors/transporter';
```

Initialize Mirrors at the source:

```js
new mirrors.Embed({
  target: document.body,
  props: {
    createTransporter({ role, uid }) {
      return new LocalStorageTransporter({
        role,
        uid,
      });
    },
  },
});
```

Initialize Mirrors at the target:

```js
new mirrors.App({
  target: document.body,
  props: {
    createTransporter({ role, uid }) {
      return new LocalStorageTransporter({
        role,
        uid,
      });
    },
  },
});
```

Use other transporters:

```js
new mirrors.App({
  target: document.body,
  props: {
    createTransporter({ role, uid }) {
      return new PeerjsTransporter({
        role,
        uid,
        peerHost: 'localhost',
        peerPort: 9000,
        peerPath: '/myapp',
      });
    },
  },
});
```

The transporters supported by Mirrors：

| name                    | options                             | description                                                                                                  |
| ----------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| LocalStorageTransporter | role,uid                            | Implemented with local-storage, good for testing and demo.                                                   |
| PeerjsTransporter       | role,uid,peerHost,peerPort,peerPath | A wrapper of [Peerjs](https://github.com/peers/peerjs), need to set up a Peerjs-server.                      |
| AgoraRtmTransporter     | role,uid,agoraAppId                 | A wrapper of [Agora RTM](https://www.agora.io/en/real-time-messaging/) service，need register for an app id. |
