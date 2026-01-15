import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface Message {
  id: string;
  from: string;
  to: string;
  text: string;
  ttl: number;
  route: string[];
  status: 'pending' | 'sent' | 'delivered' | 'acknowledged';
  timestamp: number;
}

const MAX_TTL = 5;
const DEVICE_ID_KEY = 'device_id_v23';
const CHATS_KEY = 'chats_v23';
const PSK = 'Место Встречи 2025';
const SALT = new Uint8Array([
  0x4d, 0x65, 0x73, 0x74, 0x6f, 0x20, 0x56, 0x73, 0x74, 0x72, 0x65, 0x63, 0x68, 0x69, 0x20, 0x32
]);

const deriveKeyFromPSK = async (): Promise<CryptoKey> => {
  const encoder = new TextEncoder();
  const pskBuffer = encoder.encode(PSK);
  const keyMaterial = await window.crypto.subtle.importKey('raw', pskBuffer, 'PBKDF2', false, ['deriveKey']);
  return await window.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: SALT, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

const encryptMessage = async (plaintext: string): Promise<string> => {
  const key = await deriveKeyFromPSK();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(plaintext);
  const encrypted = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
};

const decryptMessage = async (encryptedB64: string): Promise<string> => {
  const key = await deriveKeyFromPSK();
  const combined = Uint8Array.from(atob(encryptedB64), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
};

const getBrowserName = () => {
  const ua = navigator.userAgent;
  if (ua.includes('YaBrowser') || ua.includes('Yandex')) return 'Яндекс';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  return 'Другой браузер';
};

const Chat = () => {
  const [deviceId, setDeviceId] = useState<string>(() => 
    localStorage.getItem(DEVICE_ID_KEY) || `device_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  );
  const [peers, setPeers] = useState<Set<string>>(new Set());
  const [chats, setChats] = useState<Record<string, Message[]>>(() => {
    const data = localStorage.getItem(CHATS_KEY);
    return data ? JSON.parse(data) : {};
  });
  const [inputText, setInputText] = useState('');
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [browser, setBrowser] = useState<string>('');

  const storageRef = useRef<{ lastHello: number }>({ lastHello: 0 });

  useEffect(() => {
    const browserName = getBrowserName();
    setBrowser(browserName);

    const interval = setInterval(() => {
      const now = Date.now();
      if (now - storageRef.current.lastHello > 2000) {
        localStorage.setItem(`hello_${deviceId}`, `${now}`);
        storageRef.current.lastHello = now;
      }
    }, 3000);

    const handleStorage = (e: StorageEvent) => {
      if (e.key?.startsWith('hello_') && e.newValue) {
        const senderId = e.key.replace('hello_', '');
        if (senderId !== deviceId) {
          setPeers(prev => {
            const newSet = new Set(prev);
            newSet.add(senderId);
            return newSet;
          });
        }
      }

      if (e.key === 'message') {
        const msg = JSON.parse(e.newValue || '{}');
        handleMessage(msg);
      }

      if (e.key === 'ack') {
        const ack = JSON.parse(e.newValue || '{}');
        setChats(prev => {
          const newChats = { ...prev };
          for (const peer in newChats) {
            newChats[peer] = newChats[peer].map(m =>
              m.id === ack.messageId ? { ...m, status: 'acknowledged' } : m
            );
          }
          return newChats;
        });
      }
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorage);
    };
  }, [deviceId]);

  const handleMessage = async (msg: Message) => {
    let decryptedText = '[Ошибка расшифровки]';
    try {
      decryptedText = await decryptMessage(msg.text);
    } catch (error) {
      console.error('Decryption error:', error);
    }

    if (msg.to === deviceId) {
      setChats(prev => {
        const newChats = { ...prev };
        if (!newChats[msg.from]) newChats[msg.from] = [];
        newChats[msg.from].push({ ...msg, text: decryptedText, status: 'delivered' });
        return newChats;
      });

      localStorage.setItem('ack', JSON.stringify({
        messageId: msg.id,
        from: deviceId,
        to: msg.from,
      }));
    } else if (msg.ttl > 0 && msg.status !== 'acknowledged') {
      const forwarded: Message = {
        ...msg,
        ttl: msg.ttl - 1,
        route: [...msg.route, deviceId],
      };
      setChats(prev => {
        const newChats = { ...prev };
        if (!newChats[forwarded.to]) newChats[forwarded.to] = [];
        newChats[forwarded.to].push({ ...forwarded, text: decryptedText });
        return newChats;
      });
      localStorage.setItem('message', JSON.stringify(forwarded));
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !selectedPeer) return;
    const original = inputText.trim();
    let encrypted = '';
    try {
      encrypted = await encryptMessage(original);
    } catch (error) {
      alert('Ошибка шифрования');
      return;
    }

    const msg: Message = {
      id: crypto.randomUUID(),
      from: deviceId,
      to: selectedPeer,
      text: encrypted,
      ttl: MAX_TTL,
      route: [deviceId],
      status: 'sent',
      timestamp: Date.now(),
    };

    setInputText('');

    setChats(prev => {
      const newChats = { ...prev };
      if (!newChats[selectedPeer]) newChats[selectedPeer] = [];
      newChats[selectedPeer].push({ ...msg, text: original, status: 'sent' });
      return newChats;
    });

    localStorage.setItem('message', JSON.stringify(msg));
  };

  const getStatusText = (status: Message['status']) => {
    switch (status) {
      case 'pending': return 'в очереди';
      case 'sent': return 'отправлено';
      case 'delivered': return 'доставлено';
      case 'acknowledged': return 'подтверждено';
      default: return '';
    }
  };

  const getRouteText = (route: string[]) => route.length <= 2 ? 'напрямую' : `через ${route.length - 2} узл(а/ов)`;

  const showQr = async () => {
    const url = await QRCode.toDataURL(`${browser}:${deviceId}`, { width: 240 });
    setQrDataUrl(url);
  };

  const currentMessages = selectedPeer ? chats[selectedPeer] || [] : [];

  return (
    <div className="container">
      <div className="header">
        <h1>MESSENGER</h1>
        <p>Автономный зашифрованный мессенджер</p>
      </div>

      <div className={`connection-status ${peers.size > 0 ? 'online' : ''}`}>
        <span className="dot"></span>
        Вы используете: <strong>{browser}</strong>
      </div>

      <div className="browser-info">
        📌 <strong>Инструкция:</strong><br/>
        1. Откройте этот сайт в любом браузере<br/>
        2. Подождите 3 секунды<br/>
        3. ID других браузеров появятся в списке<br/>
        4. Выберите контакт и отправьте сообщение
      </div>

      <div className="device-info">
        <code>{deviceId}</code>
        <button className="action-button" onClick={() => setDeviceId(prompt('Новый ID:', deviceId) || deviceId)}>
          Изменить
        </button>
        <button className="action-button" onClick={showQr}>
          QR
        </button>
      </div>

      <div className="chat-container">
        <div className="peers-list">
          {Array.from(peers).length === 0 ? (
            <div style={{ padding: '8px 16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Нет активных контактов
            </div>
          ) : (
            Array.from(peers).map(id => (
              <div
                key={id}
                className={`peer-item ${selectedPeer === id ? 'active' : ''}`}
                onClick={() => setSelectedPeer(id)}
              >
                <div className="peer-status"></div>
                <div>{id}</div>
              </div>
            ))
          )}
        </div>

        <div className="messages">
          {currentMessages.length === 0 ? (
            <div className="messages empty">
              Выберите контакт для начала диалога.
            </div>
          ) : (
            currentMessages.map(msg => (
              <div key={msg.id} className={`message ${msg.from === deviceId ? 'sent' : 'received'}`}>
                <div className="message-content">
                  <div className="message-header">
                    {msg.from === deviceId ? 'Вы' : msg.from}
                  </div>
                  <div className="message-body">{msg.text}</div>
                  <div className="message-footer">
                    {getStatusText(msg.status)} • {getRouteText(msg.route)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="message-form">
          <div className="input-group">
            <input
              type="text"
              className="message-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Введите сообщение..."
              disabled={!selectedPeer}
            />
            <button 
              className="send-button"
              onClick={sendMessage} 
              disabled={!selectedPeer || !inputText.trim()}
            >
              <span className="send-button-icon">✈︎</span>
            </button>
          </div>
        </div>
      </div>

      {qrDataUrl && (
        <div className="modal" onClick={() => setQrDataUrl(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <img src={qrDataUrl} alt="QR" />
            <p>ID: {deviceId}<br/>Браузер: {browser}</p>
            <button onClick={() => setQrDataUrl(null)}>Закрыть</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;