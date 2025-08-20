import React, { useState, useEffect, useRef } from 'react';
import { FaPaperPlane, FaBluetooth } from 'react-icons/fa';

import './App.css';

// Импорты сервисов
import { initPeer, sendMessage } from './services/peerService';
import { addMessage, getMessageQueue, removeMessage } from './services/messageQueue';
import { decryptMessage, encryptMessage } from './utils/crypto';
import { getDeviceId } from './utils/deviceId';

const App = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [targetId, setTargetId] = useState('');
  const [theme, setTheme] = useState('light');
  const [isConnected, setIsConnected] = useState(false);
  const [flyingId, setFlyingId] = useState(null);
  const messagesEndRef = useRef(null);

  const MY_DEVICE_ID = getDeviceId();
  let peerInstance = null;

  // Автоопределение темы по времени
  useEffect(() => {
    const hour = new Date().getHours();
    const saved = localStorage.getItem('app-theme');
    if (saved) {
      setTheme(saved);
    } else {
      setTheme(hour >= 20 || hour < 7 ? 'dark' : 'light');
    }
  }, []);

  // Сохранение темы
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendAck = (msgId, recipientId) => {
    const ackMsg = {
      type: 'ACK',
      msgId,
      from: MY_DEVICE_ID,
      to: recipientId,
    };
    sendMessage(recipientId, ackMsg);
  };

  const forwardMessage = (msg) => {
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
    if (data.type === 'ACK') {
      if (data.to === MY_DEVICE_ID) {
        removeMessage(data.msgId);
      }
      return;
    }

    const msg = { ...data };
    if (msg.hopCount >= msg.maxHops) return;
    msg.hopCount += 1;

    if (msg.to === MY_DEVICE_ID) {
      try {
        const decrypted = await decryptMessage(msg.content, 'mesh2025');
        const fullMsg = { ...msg, decryptedContent: decrypted };
        addMessage(fullMsg);
        setMessages((prev) => [...prev, fullMsg]);
        setIsConnected(true);
        sendAck(msg.id, msg.from);
      } catch (e) {
        const errorMsg = { ...msg, decryptedContent: '(ошибка)' };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } else {
      forwardMessage(msg);
    }
  };

  const sendMessageTo = async () => {
    if (!newMessage.trim() || !targetId) return;

    try {
      const encrypted = await encryptMessage(newMessage, 'mesh2025');
      const msg = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        from: MY_DEVICE_ID,
        to: targetId,
        content: encrypted,
        timestamp: Date.now(),
        hopCount: 0,
        maxHops: 10,
      };

      addMessage(msg);
      setMessages((prev) => [...prev, msg]);
      setFlyingId(msg.id);
      setTimeout(() => setFlyingId(null), 600);

      sendMessage(targetId, msg);
      setNewMessage('');
    } catch (e) {
      console.error('Ошибка шифрования:', e);
    }
  };

  useEffect(() => {
    peerInstance = initPeer(handleIncomingMessage);
    setMessages(getMessageQueue());

    return () => {
      if (peerInstance) peerInstance.destroy();
    };
  }, []);

  return (
    <div className="container">
      <header className="header">
        <h1>Место Встречи</h1>
        <p>Оффлайновый мессенджер</p>
      </header>

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
            placeholder="ID собеседника"
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
                      {msg.from === MY_DEVICE_ID ? 'Вы' : 'Собеседник'}
                    </div>
                  )}
                  <div className="message-body">{msg.decryptedContent || '(зашифровано)'}</div>
                  <div className="message-footer">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <footer className="footer">
        Место Встречи © 2025 • Без интернета
      </footer>
    </div>
  );
};

export default App;