// src/services/peerService.js
import Peer from 'peerjs';
import { getDeviceId } from '../utils/deviceId';

let peerInstance = null;

export const initPeer = (onMessageReceived) => {
  const deviceId = getDeviceId();
  peerInstance = new Peer(deviceId);

  peerInstance.on('connection', (conn) => {
    conn.on('data', (data) => {
      onMessageReceived(data);
    });
  });

  peerInstance.on('error', (err) => {
    console.error('PeerJS ошибка:', err);
  });

  return peerInstance;
};

export const connectToDevice = (targetDeviceId) => {
  if (!peerInstance) return null;
  return peerInstance.connect(targetDeviceId);
};

export const sendMessage = (targetId, message) => {
  const conn = peerInstance.connect(targetId);
  conn.on('open', () => {
    conn.send(message);
  });
  conn.on('error', (err) => {
    console.error('Ошибка отправки:', err);
  });
};