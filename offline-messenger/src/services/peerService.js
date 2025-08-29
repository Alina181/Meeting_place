import Peer from 'peerjs';
import { getDeviceId } from '../utils/deviceId';

let peerInstance = null;

export const initPeer = (onMessage) => {
  const id = getDeviceId();
  peerInstance = new Peer(id, {
    host: 'localhost',
    port: 9000,
    path: '/peerjs',
    secure: false,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    }
  });

  peerInstance.on('connection', (conn) => {
    conn.on('data', onMessage);
  });

  peerInstance.on('error', (err) => {
    console.error('PeerJS ошибка:', err);
  });

  return peerInstance;
};

export const sendMessage = (targetId, msg) => {
  if (!peerInstance) return console.error('Peer не инициализирован');
  const conn = peerInstance.connect(targetId);
  conn.on('open', () => conn.send(msg));
  conn.on('error', (err) => console.error('Ошибка отправки:', err));
};

export const getPeerInstance = () => peerInstance;