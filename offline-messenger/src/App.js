import React, { useState, useEffect, useRef } from 'react';
import { FaPaperPlane, FaBluetooth, FaClock, FaCheck, FaCheckDouble, FaDownload } from 'react-icons/fa';

import './App.css';
import { initPeer, sendMessage } from './services/peerService';
import { addMessage as saveToStorage, getMessageQueue, removeMessage, updateMessageStatus } from './services/messageQueue';
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
  const messagesEndRef = useRef(null);
  const peerInstanceRef = useRef(null);

  const MY_DEVICE_ID = getDeviceId();

  const addMessage = (msg) => {
    setMessages((prev) => {
      if (prev.some(m => m.id === msg.id)) return prev;
      const updated = [...prev, msg];
      localStorage.setItem('messageQueue', JSON.stringify(updated));
      return updated;
    });
  };

  // Обновление
  const updateMessage = (msgId, updates) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, ...updates } : m))
    );
  };

  // Загрузка
  useEffect(() => {
    const saved = getMessageQueue();
    setMessages(saved);
  }, []);

  useEffect(() => {
    const hour = new Date().getHours();
    const saved = localStorage.getItem('app-theme');
    if (saved) {
      setTheme(saved);
    } else {
      setTheme(hour >= 20 || hour < 7 ? 'dark' : 'light');
    }
  }, []);

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  // Прокрутка вниз
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // ACK (доставлено) 
  const sendAck = (msgId, recipientId) => {
    const ackMsg = {
      type: 'ACK',
      msgId,
      from: MY_DEVICE_ID,
      to: recipientId,
    };
    sendMessage(recipientId, ackMsg);
  };

  // Read Receipt (прочитано) 
  const sendReadReceipt = (msgId, recipientId) => {
    const readMsg = {
      type: 'READ',
      msgId,
      from: MY_DEVICE_ID,
      to: recipientId,
    };
    sendMessage(recipientId, readMsg);
  };

  const forwardMessage = (msg) => {
    const peerInstance = peerInstanceRef.current;
    if (!peerInstance) return;

    Object.keys(peerInstance.connections).forEach((peerId) => {
      if (peerId !== msg.from) {
        const conn = peerInstance.connections[peerId][0];
        if (conn && conn.open) {
          conn.send(msg);
        }
      }
    });
  };

  const handleIncomingMessage = async (data) => {
    if (data.from === MY_DEVICE_ID) {
      console.log('🔁 Игнор: своё сообщение', data.id);
      return;
    }

    // ACK — доставлено
    if (data.type === 'ACK') {
      if (data.to === MY_DEVICE_ID) {
        updateMessage(data.msgId, { status: 'delivered' });
      }
      return;
    }

    // READ — прочитано
    if (data.type === 'READ') {
      if (data.to === MY_DEVICE_ID) {
        updateMessage(data.msgId, { status: 'read' });
      }
      return;
    }

    if (messages.some(m => m.id === data.id)) {
      return;
    }

    let msg = { ...data };

    if (msg.hopCount >= msg.maxHops) return;
    msg.hopCount += 1;

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
        const errorMsg = {
          ...msg,
          decryptedContent: '(ошибка)',
          status: 'delivered',
        };
        addMessage(errorMsg);
      }
    } else {
      forwardMessage(msg);
    }
  };

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
        maxHops: 10,
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

    return () => {
      if (peerInstance) peerInstance.destroy();
    };
  }, []);

  // PWA
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
        <p>Оффлайновый мессенджер</p>
      </header>

      {/* Кнопка PWA */}
      {showInstallButton && (
        <div
          style={{
            backgroundColor: '#4C7DFF',
            color: 'white',
            padding: '12px 16px',
            textAlign: 'center',
            fontSize: '0.95rem',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer',
            borderTop: '1px solid rgba(255,255,255,0.2)',
          }}
          onClick={handleInstallClick}
        >
          <FaDownload />
          Установить приложение2.0
        </div>
      )}

      <div className={`connection-status ${isConnected ? 'online' : ''}`}>
        <FaBluetooth /> <div className="dot"></div>
        {isConnected ? 'Подключено' : 'Поиск...'}
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
        <strong>ID:</strong> <code>{MY_DEVICE_ID}</code>
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

      <div className="messages">
        {messages.length === 0 ? (
          <div className="empty">📭 Нет сообщений</div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.from === MY_DEVICE_ID;
            return (
              <div
                key={msg.id}
                className={`message ${isMe ? 'sent' : 'received'} ${flyingId === msg.id ? 'flying' : ''}`}
              >
                <div className="message-content">
                  {!isMe && (
                    <div className="message-header">
                      Собеседник
                    </div>
                  )}
                  <div className="message-body">{msg.decryptedContent || '(ошибка)'}</div>
                  <div className="message-footer">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                    {isMe && (
                      <span style={{ marginLeft: '8px' }}>
                        {msg.status === 'sent' && <FaClock title="Отправлено" />}
                        {msg.status === 'delivered' && <FaCheck title="Доставлено" />}
                        {msg.status === 'read' && <FaCheckDouble title="Прочитано" style={{ color: '#6a9eff' }} />}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <footer className="footer">
        Место Встречи2.0 © 2025 • Без интернета • Установите приложение
      </footer>
    </div>
  );
};

export default App;