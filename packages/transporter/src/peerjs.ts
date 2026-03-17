/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import './parcel-require';
import Peer from 'peerjs';
import {
  Transporter,
  TransporterEvents,
  TransporterEventHandler,
} from '@syncit/core';
import { Chunk, RemoteControlPayload } from '@syncit/core';
import { eventWithTime } from '@rrweb/types';

export type PeerjsTransporterOptions = {
  uid: string;
  role: 'embed' | 'app';
  peerHost: string;
  peerPort: number;
  peerPath: string;
};

const sleep = (ms: number) =>
  new Promise(resolve =>
    setTimeout(() => {
      resolve(undefined);
    }, ms)
  );

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

export class PeerjsTransporter implements Transporter {
  handlers: Record<TransporterEvents, Array<TransporterEventHandler>> = {
    [TransporterEvents.SourceReady]: [],
    [TransporterEvents.MirrorReady]: [],
    [TransporterEvents.Start]: [],
    [TransporterEvents.SendRecord]: [],
    [TransporterEvents.AckRecord]: [],
    [TransporterEvents.Stop]: [],
    [TransporterEvents.RemoteControl]: [],
  };

  uid: string;
  role: PeerjsTransporterOptions['role'];
  peer: Peer;
  // Embed: multiple connections (1:N), App: single connection
  conns: Peer.DataConnection[] = [];
  opened = false;
  // Track which connection sent the last message (for targeted replies)
  private _lastSender?: Peer.DataConnection;

  constructor(options: PeerjsTransporterOptions) {
    const { uid, role, peerHost, peerPort, peerPath } = options;
    this.uid = uid;
    this.role = role;
    // App gets a random suffix to avoid peer ID collision
    const peerId =
      this.role === 'embed'
        ? `${this.uid}-embed`
        : `${this.uid}-app-${randomSuffix()}`;
    this.peer = new Peer(peerId, {
      host: peerHost,
      port: peerPort,
      path: peerPath,
    });
    this.peer.on('connection', conn => {
      this.setupConn(conn);
    });
  }

  private setupConn(conn: Peer.DataConnection) {
    conn.on('open', () => {
      this.conns.push(conn);
      this.opened = true;
      console.info(
        `[${this.role}] connection opened (total: ${this.conns.length})`,
        Date.now()
      );
    });
    conn.on('data', data => {
      const { event, payload } = data;
      // Remember which connection sent this message
      this._lastSender = conn;
      this.handlers[event as TransporterEvents].map(h =>
        h({
          event: event,
          payload: payload,
        })
      );
    });
    conn.on('close', () => {
      this.conns = this.conns.filter(c => c !== conn);
      if (this._lastSender === conn) {
        this._lastSender = undefined;
      }
      console.info(
        `[${this.role}] connection closed (remaining: ${this.conns.length})`
      );
    });
    conn.on('error', e => {
      console.error(e);
    });
  }

  get embedUid() {
    return `${this.uid}-embed`;
  }

  connect() {
    return new Promise(resolve => {
      // App always connects to the embed peer
      const targetId = `${this.uid}-embed`;
      const conn = this.peer.connect(targetId, {
        serialization: 'json',
      });
      this.setupConn(conn);
      conn.on('open', () => {
        resolve(undefined);
      });
    });
  }

  /** Broadcast to all connections */
  async broadcast<T>(data: T) {
    if (this.conns.length === 0) {
      await this.connect();
    }
    while (this.role === 'embed' && !this.opened) {
      await sleep(50);
    }
    this.conns.forEach(conn => conn.send(data));
  }

  /** Send only to the connection that last sent us a message (for signaling replies) */
  private sendToSender<T>(data: T) {
    if (this._lastSender) {
      this._lastSender.send(data);
    }
  }

  /**
   * For embed role: signaling messages reply to sender only.
   * For app role (single connection): always sends to the one connection.
   */
  async send<T>(data: T) {
    return this.broadcast(data);
  }

  login(): Promise<boolean> {
    return Promise.resolve(true);
  }

  // --- Signaling messages: reply to sender only (for embed), broadcast for app ---

  sendSourceReady() {
    if (this.role === 'embed' && this._lastSender) {
      this.sendToSender({ event: TransporterEvents.SourceReady });
      return Promise.resolve();
    }
    return this.broadcast({ event: TransporterEvents.SourceReady });
  }

  sendMirrorReady() {
    return this.broadcast({ event: TransporterEvents.MirrorReady });
  }

  sendStart() {
    return this.broadcast({ event: TransporterEvents.Start });
  }

  // --- Data messages: always broadcast to all ---

  sendRecord(record: Chunk<eventWithTime>) {
    return this.broadcast({
      event: TransporterEvents.SendRecord,
      payload: record,
    });
  }

  ackRecord(id: number) {
    return this.broadcast({
      event: TransporterEvents.AckRecord,
      payload: id,
    });
  }

  sendStop() {
    return this.broadcast({
      event: TransporterEvents.Stop,
    });
  }

  sendRemoteControl(payload: RemoteControlPayload) {
    return this.broadcast({
      event: TransporterEvents.RemoteControl,
      payload,
    });
  }

  on(event: TransporterEvents, handler: TransporterEventHandler) {
    this.handlers[event].push(handler);
  }
}
