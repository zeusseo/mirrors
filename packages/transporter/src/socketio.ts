/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { io, Socket } from 'socket.io-client';
import { eventWithTime } from '@rrweb/types';
import { Chunk, RemoteControlPayload } from '@mirrors/core';
import {
  type Transporter,
  TransporterEvents,
  type TransporterEventHandler,
  type TransporterHandlers,
} from '@mirrors/core';

export type SocketIoTransporterOptions = {
  url: string;
  uid: string;
  role: 'embed' | 'app';
};

export class SocketIoTransporter implements Transporter {
  handlers: TransporterHandlers = {
    [TransporterEvents.SourceReady]: [],
    [TransporterEvents.MirrorReady]: [],
    [TransporterEvents.Start]: [],
    [TransporterEvents.SendRecord]: [],
    [TransporterEvents.AckRecord]: [],
    [TransporterEvents.Stop]: [],
    [TransporterEvents.RemoteControl]: [],
  };

  private socket: Socket;
  uid: string;
  role: SocketIoTransporterOptions['role'];

  constructor(options: SocketIoTransporterOptions) {
    const { url, uid, role } = options;
    this.uid = uid;
    this.role = role;

    this.socket = io(url, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      this.socket.emit('join', { uid: this.uid, role: this.role });
    });

    this.socket.on('mirrors', (data: { event: TransporterEvents; payload?: unknown }) => {
      this.handlers[data.event].map(h =>
        h({
          event: data.event,
          payload: data.payload,
        })
      );
    });
  }

  private send(params: { event: TransporterEvents; payload?: unknown }) {
    this.socket.emit('mirrors', params);
  }

  login(): Promise<boolean> {
    return new Promise(resolve => {
      if (this.socket.connected) {
        resolve(true);
      } else {
        this.socket.on('connect', () => resolve(true));
      }
    });
  }

  sendSourceReady() {
    this.send({ event: TransporterEvents.SourceReady });
    return Promise.resolve();
  }

  sendMirrorReady() {
    this.send({ event: TransporterEvents.MirrorReady });
    return Promise.resolve();
  }

  sendStart() {
    this.send({ event: TransporterEvents.Start });
    return Promise.resolve();
  }

  sendRecord(record: Chunk<eventWithTime>) {
    this.send({
      event: TransporterEvents.SendRecord,
      payload: record,
    });
    return Promise.resolve();
  }

  ackRecord(id: number) {
    this.send({
      event: TransporterEvents.AckRecord,
      payload: id,
    });
    return Promise.resolve();
  }

  sendStop() {
    this.send({ event: TransporterEvents.Stop });
    return Promise.resolve();
  }

  sendRemoteControl(payload: RemoteControlPayload) {
    this.send({
      event: TransporterEvents.RemoteControl,
      payload,
    });
    return Promise.resolve();
  }

  on(event: TransporterEvents, handler: TransporterEventHandler) {
    this.handlers[event].push(handler);
  }
}
