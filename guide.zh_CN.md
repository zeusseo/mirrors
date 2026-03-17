# 使用指南

**目前 Mirrors 还处于早期开发阶段，使用方式可能随时发生变化。**

## 快速开始

使用 Mirrors 需要安装 `@mirrors/ui` 和 `@mirrors/transporter`：

```
npm i @mirrors/ui @mirrors/transporter
```

引入 Mirrors，使用 local storage transporter 作为传输层：

```js
import mirrors from '@mirrors/ui';
import '@mirrors/ui/dist/style.css';
import { LocalStorageTransporter } from '@mirrors/transporter';
```

在源端初始化 Mirrors：

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

在对端初始化 Mirrors：

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

使用不同的 transporter：

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

Mirrors 目前支持的 transporter 如下：

| 名称                    | 参数                                | 描述                                                                                    |
| ----------------------- | ----------------------------------- | --------------------------------------------------------------------------------------- |
| LocalStorageTransporter | role,uid                            | 基于 local-storage 实现，用于测试或演示。                                               |
| PeerjsTransporter       | role,uid,peerHost,peerPort,peerPath | 基于 [Peerjs](https://github.com/peers/peerjs) 实现，需自行搭建 Peerjs-server           |
| AgoraRtmTransporter     | role,uid,agoraAppId                 | 基于 [Agora RTM](https://www.agora.io/en/real-time-messaging/) 服务实现，需注册应用账号 |
