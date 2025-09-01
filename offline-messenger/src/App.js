import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaPaperPlane, FaNetworkWired, FaClock, FaCheck, FaCheckDouble, FaDownload } from 'react-icons/fa';

import './App.css';
import { initPeer, sendMessage } from './services/peerService';
import { addMessage as saveToStorage, getMessageQueue, updateMessageStatus } from './services/messageQueue';
import { encryptMessage, decryptMessage } from './utils/crypto';
import { getDeviceId } from './utils/deviceId';

const App = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [targetId, setTargetId] = useState('');
  const [theme, setTheme] = useState('light');
  const [isConnected, setIsConnected] = useState(false);
  const [flyingId, setFlyingId] = useState(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [peerCount, setPeerCount] = useState(0);

  const MY_DEVICE_ID = getDeviceId();
  const MAX_HOPS = 10;
  const messagesEndRef = useRef(null);
  const peerInstanceRef = useRef(null);

  // Загрузка сообщений из хранилища
  useEffect(() => {
    const saved = getMessageQueue();
    setMessages(saved);
  }, []);

  // Установка темы (светлая/тёмная)
  useEffect(() => {
    const hour = new Date().getHours();
    const savedTheme = localStorage.getItem('app-theme');
    setTheme(savedTheme || (hour >= 20 || hour < 7 ? 'dark' : 'light'));
  }, []);

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  // Авто-скролл к последнему сообщению
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Добавление нового сообщения
  const addMessage = useCallback((msg) => {
    setMessages((prev) => {
      if (prev.some(m => m.id === msg.id)) return prev;
      const updated = [...prev, msg];
      localStorage.setItem('messageQueue', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Обновление статуса сообщения
  const updateMessage = useCallback((msgId, updates) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, ...updates } : m))
    );
  }, []);

  // Отправка ACK (доставлено)
  const sendAck = useCallback((msgId, recipientId) => {
    const ackMsg = {
      type: 'ACK',
      msgId,
      from: MY_DEVICE_ID,
      to: recipientId,
      hopCount: 0,
      maxHops: MAX_HOPS,
    };
    sendMessage(recipientId, ackMsg);
  }, [MY_DEVICE_ID]);

  // Отправка Read Receipt (прочитано)
  const sendReadReceipt = useCallback((msgId, recipientId) => {
    const readMsg = {
      type: 'READ',
      msgId,
      from: MY_DEVICE_ID,
      to: recipientId,
      hopCount: 0,
      maxHops: MAX_HOPS,
    };
    sendMessage(recipientId, readMsg);
  }, [MY_DEVICE_ID]);

  // Ретрансляция сообщения
  const forwardMessage = useCallback((msg) => {
    const peerInstance = peerInstanceRef.current;
    if (!peerInstance) return;

    msg.hopCount += 1;
    if (msg.hopCount >= msg.maxHops) {
      console.log(`⛔ Лимит прыжков достигнут: ${msg.id}`);
      return;
    }

    Object.keys(peerInstance.connections).forEach((peerId) => {
      if (peerId !== msg.from) {
        const conn = peerInstance.connections[peerId][0];
        if (conn && conn.open) {
          conn.send(msg);
        }
      }
    });

    console.log(`🔁 Ретрансляция: ${msg.id} → ${Object.keys(peerInstance.connections).join(', ')}`);
  }, []);

  // Обработка входящего сообщения
  const handleIncomingMessage = useCallback(async (data) => {
    if (data.from === MY_DEVICE_ID) return;
    if (messages.some(m => m.id === data.id)) return;

    const msg = { ...data };

    if (msg.type === 'ACK') {
      if (msg.to === MY_DEVICE_ID) {
        updateMessage(msg.msgId, { status: 'delivered' });
      } else {
        forwardMessage(msg);
      }
      return;
    }

    if (msg.type === 'READ') {
      if (msg.to === MY_DEVICE_ID) {
        updateMessage(msg.msgId, { status: 'read' });
      } else {
        forwardMessage(msg);
      }
      return;
    }

    if (msg.to === MY_DEVICE_ID) {
      try {
        const decrypted = await decryptMessage(msg.content);
        const fullMsg = {
          ...msg,
          decryptedContent: decrypted,
          status: 'delivered',
        };
        addMessage(fullMsg);
        setIsConnected(true);
        sendAck(msg.id, msg.from);
        sendReadReceipt(msg.id, msg.from);
      } catch (e) {
        addMessage({
          ...msg,
          decryptedContent: '(ошибка расшифровки)',
          status: 'delivered',
        });
      }
    } else {
      forwardMessage(msg);
    }
  }, [messages, MY_DEVICE_ID, addMessage, updateMessage, sendAck, sendReadReceipt, forwardMessage]);

  // Отправка сообщения
  const sendMessageTo = async () => {
    if (!newMessage.trim() || !targetId) return;
    if (targetId === MY_DEVICE_ID) {
      alert('Нельзя отправить себе');
      return;
    }

    try {
      const encrypted = await encryptMessage(newMessage);
      const msgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const msg = {
        id: msgId,
        from: MY_DEVICE_ID,
        to: targetId,
        content: encrypted,
        timestamp: Date.now(),
        hopCount: 0,
        maxHops: MAX_HOPS,
        decryptedContent: newMessage,
        status: 'sent',
      };

      addMessage(msg);
      setFlyingId(msgId);
      setTimeout(() => setFlyingId(null), 600);

      sendMessage(targetId, msg);
      setNewMessage('');
    } catch (e) {
      console.error('Ошибка шифрования:', e);
    }
  };

  // Инициализация P2P
  useEffect(() => {
    const peerInstance = initPeer(handleIncomingMessage);
    peerInstanceRef.current = peerInstance;

    peerInstance.on('connection', () => {
      setPeerCount(Object.keys(peerInstance.connections).length);
    });
    peerInstance.on('disconnected', () => {
      setPeerCount(Object.keys(peerInstance.connections).length);
    });

    return () => {
      if (peerInstance) peerInstance.destroy();
    };
  }, [handleIncomingMessage]);

  // PWA: установка
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallButton(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', () => {
      setShowInstallButton(false);
      setInstallPrompt(null);
      console.log('PWA: Приложение установлено');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    console.log(`PWA: Установка ${outcome}`);
    setInstallPrompt(null);
    setShowInstallButton(false);
  };

  return (
    <div className="container">
      <header className="header">
        <h1>Место Встречи</h1>
        <p>Оффлайновый mesh-мессенджер</p>
      </header>

      {/* Кнопка установки PWA */}
      {showInstallButton && (
        <div className="install-button" onClick={handleInstallClick}>
          <FaDownload />
          Установить приложение
        </div>
      )}

      <div className={`connection-status ${isConnected ? 'online' : ''}`}>
        <FaNetworkWired /> {peerCount} узлов | {isConnected ? 'Mesh-сеть активна' : 'Поиск...'}
      </div>

      <div className="theme-toggle">
        <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>
          Светлая
        </button>
        <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>
          Тёмная
        </button>
      </div>

      <div className="device-info">
        <strong>Ты:</strong> <code>{MY_DEVICE_ID}</code>
      </div>

      <div className="messages">
        {messages.length === 0 ? (
          <div className="empty">📭 Нет сообщений</div>
        ) : (
          messages.map((msg) => (
            <Message
              key={msg.id}
              message={msg}
              isMe={msg.from === MY_DEVICE_ID}
              flying={flyingId === msg.id}
              MY_DEVICE_ID={MY_DEVICE_ID}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="message-form">
        <div className="input-group">
          <input
            type="text"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            placeholder="ID получателя"
          />
          <button onClick={sendMessageTo} disabled={!newMessage.trim() || !targetId}>
            <FaPaperPlane />
          </button>
        </div>
        <textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Напишите сообщение..."
        />
      </div>

      <footer className="footer">
        Место Встречи © 2025 • Mesh-сеть • Без интернета
      </footer>
    </div>
  );
};

// Компонент сообщения (оптимизирован)
const Message = React.memo(({ message, isMe, flying }) => {
  return (
    <div className={`message ${isMe ? 'sent' : 'received'} ${flying ? 'flying' : ''}`}>
      <div className="message-content">
        {!isMe && message.hopCount > 0 && (
          <div className="message-header">через {message.hopCount} прыжка(ов)</div>
        )}
        <div className="message-body">{message.decryptedContent || '(ошибка)'}</div>
        <div className="message-footer">
          {new Date(message.timestamp).toLocaleTimeString()}
          {isMe && (
            <span style={{ marginLeft: '8px' }}>
              {message.status === 'sent' && <FaClock title="Отправлено" />}
              {message.status === 'delivered' && <FaCheck title="Доставлено" />}
              {message.status === 'read' && (
                <FaCheckDouble title="Прочитано" style={{ color: '#6a9eff' }} />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

export default App;