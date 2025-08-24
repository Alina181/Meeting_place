import Peer from 'peerjs';
import { getDeviceId } from '../utils/deviceId';

let peerInstance = null;

const PEER_SERVER_HOST = '192.168.1.10'; 
const PEER_SERVER_PORT = 9000;
const PEER_SERVER_PATH = '/peerjs';

export const initPeer = (onMessageReceived) => {
  const deviceId = getDeviceId();

  peerInstance = new Peer(deviceId, {
    host: PEER_SERVER_HOST,
    port: PEER_SERVER_PORT,
    path: PEER_SERVER_PATH,
    secure: false, // HTTP
  });

  peerInstance.on('connection', (conn) => {
    conn.on('data', (data) => {
      onMessageReceived(data);
    });
  });

  peerInstance.on('open', () => {
    console.log('✅ PeerJS: ID зарегистрирован на локальном сервере');
  });

  peerInstance.on('error', (err) => {
    console.error('PeerJS ошибка:', err);
  });

  return peerInstance;
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