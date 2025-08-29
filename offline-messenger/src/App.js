import React, { useState, useEffect, useRef } from 'react';
import { FaPaperPlane, FaClock, FaCheck, FaCheckDouble, FaDownload, FaSms, FaComment, FaUser, FaHashtag } from 'react-icons/fa';
import './App.css';
import { initPeer, sendMessage, getPeerInstance } from './services/peerService';
import { addMessage, getMessageQueue, updateMessageStatus, removeMessage } from './services/messageQueue';
import { encryptMessage, decryptMessage } from './utils/crypto';
import { getDeviceId } from './utils/deviceId';

const MAX_HOPS = 15;
const TTL = 3600000; // 1 час
const MY_DEVICE_ID = getDeviceId();

const App = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [targetId, setTargetId] = useState('');
  const [activeTab, setActiveTab] = useState('chat');
  const [theme, setTheme] = useState('light');
  const [isConnected, setIsConnected] = useState(false);
  const [flyingId, setFlyingId] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [peerCount, setPeerCount] = useState(0);
  const messagesEndRef = useRef(null);

  const peerRef = useRef(null);

  useEffect(() => {
    const saved = getMessageQueue();
    setMessages(saved);
  }, []);

  useEffect(() => {
    const hour = new Date().getHours();
    const saved = localStorage.getItem('mesh-theme');
    setTheme(saved || (hour >= 20 || hour < 7 ? 'dark' : 'light'));
  }, []);

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('mesh-theme', theme);
  }, [theme]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(() => scrollToBottom(), [messages, activeTab]);

  useEffect(() => {
    const handleInstallPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
  }, []);

  const handleInstall = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      await installPrompt.userChoice;
      setShowInstall(false);
    }
  };

  const sendAck = (msgId, recipientId, path = []) => {
    const ack = {
      type: 'ACK',
      msgId,
      from: MY_DEVICE_ID,
      to: recipientId,
      path: [...path, MY_DEVICE_ID],
      hopCount: 0,
      maxHops: MAX_HOPS,
    };
    sendMessage(recipientId, ack);
  };

  const forwardMessage = (msg) => {
    const peer = peerRef.current;
    if (!peer) return;

    msg.hopCount += 1;
    if (msg.path.includes(MY_DEVICE_ID)) return;
    msg.path.push(MY_DEVICE_ID);

    if (msg.hopCount >= msg.maxHops || msg.timestamp + TTL < Date.now()) {
      console.log(`⛔ Удалено (лимит): ${msg.id}`);
      return;
    }

    Object.keys(peer.connections).forEach((peerId) => {
      if (peerId !== msg.from) {
        const conn = peer.connections[peerId][0];
        if (conn && conn.open) {
          conn.send(msg);
        }
      }
    });
  };

  const handleIncoming = async (data) => {
    if (data.from === MY_DEVICE_ID) return;
    if (messages.some(m => m.id === data.id)) return;

    if (data.type === 'ACK') {
      if (data.to === MY_DEVICE_ID) {
        updateMessageStatus(data.msgId, 'delivered');
        setMessages(prev => prev.map(m => m.id === data.msgId ? { ...m, status: 'delivered' } : m));
      } else {
        forwardMessage(data);
      }
      removeMessage(data.msgId);
      return;
    }

    if (data.to === MY_DEVICE_ID) {
      const decrypted = await decryptMessage(data.content);
      const fullMsg = {
        ...data,
        decryptedContent: decrypted,
        status: 'delivered',
      };
      addMessage(fullMsg);
      setMessages(prev => [...prev, fullMsg]);
      setIsConnected(true);
      sendAck(data.id, data.from, data.path);
    } else {
      forwardMessage(data);
    }
  };

  useEffect(() => {
    const peer = initPeer(handleIncoming);
    peerRef.current = peer;

    peer.on('open', () => {
      console.log('mPid:', peer.id);
      setIsConnected(true);
    });

    peer.on('connection', () => {
      setPeerCount(Object.keys(peer.connections).length);
    });

    peer.on('disconnected', () => {
      setPeerCount(Object.keys(peer.connections).length);
    });

    return () => peer.destroy();
  }, []);

  const send = async () => {
    if (!getPeerInstance()) return alert('Сеть не готова');
    if (!newMessage.trim() || !targetId || targetId === MY_DEVICE_ID) return;

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
        path: [MY_DEVICE_ID],
        decryptedContent: newMessage,
        status: 'sent',
      };

      addMessage(msg);
      setMessages(prev => [...prev, msg]);
      setFlyingId(msgId);
      setTimeout(() => setFlyingId(null), 600);

      sendMessage(targetId, msg);
      setNewMessage('');
    } catch (e) {
      console.error('Ошибка:', e);
    }
  };

  const conversations = messages.reduce((acc, msg) => {
    const other = msg.from === MY_DEVICE_ID ? msg.to : msg.from;
    if (!acc[other]) acc[other] = [];
    acc[other].push(msg);
    return acc;
  }, {});

  return (
    <div className="container">
      <header className="header">
        <h1>Место Встречи</h1>
        <p>Mesh-мессенджер без интернета</p>
      </header>

      <div className="tabs">
        <button className={activeTab === 'chat' ? 'active' : ''} onClick={() => setActiveTab('chat')}>
          <FaComment /> Чат
        </button>
        <button className={activeTab === 'sms' ? 'active' : ''} onClick={() => setActiveTab('sms')}>
          <FaSms /> SMS
        </button>
      </div>

      {showInstall && (
        <div className="install-banner" onClick={handleInstall}>
          <FaDownload /> Установить приложение
        </div>
      )}

      <div className={`connection-status ${isConnected ? 'online' : ''}`}>
        <FaHashtag /> {peerCount} узлов | {isConnected ? 'Сеть активна' : 'Поиск...'}
      </div>

      <div className="theme-toggle">
        <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>Светлая</button>
        <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>Тёмная</button>
      </div>

      <div className="device-info">
        <strong>Ты:</strong> <code>{MY_DEVICE_ID}</code>
      </div>

      {activeTab === 'chat' && (
        <div className="messages">
          {messages.length === 0 ? (
            <div className="empty">📭 Нет сообщений</div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.from === MY_DEVICE_ID;
              return (
                <div key={msg.id} className={`message ${isMe ? 'sent' : 'received'} ${flyingId === msg.id ? 'flying' : ''}`}>
                  <div className="message-content">
                    {!isMe && msg.hopCount > 0 && (
                      <div className="message-header">через {msg.hopCount} прыжков</div>
                    )}
                    <div className="message-body">{msg.decryptedContent}</div>
                    <div className="message-footer">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                      {isMe && (
                        <span style={{ marginLeft: '8px' }}>
                          {msg.status === 'sent' && <FaClock />}
                          {msg.status === 'delivered' && <FaCheck />}
                          {msg.status === 'read' && <FaCheckDouble style={{ color: '#6a9eff' }} />}
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
      )}

      {activeTab === 'sms' && (
        <div className="sms-mode">
          {Object.keys(conversations).length === 0 ? (
            <div className="empty">📭 Нет диалогов</div>
          ) : (
            <div className="sms-conversations">
              {Object.keys(conversations).map((contact) => {
                const msgs = conversations[contact];
                const last = msgs[msgs.length - 1];
                const isMe = last.from === MY_DEVICE_ID;
                return (
                  <div
                    key={contact}
                    className="sms-contact-item"
                    onClick={() => {
                      setTargetId(contact);
                      setActiveTab('chat');
                    }}
                  >
                    <div className="sms-avatar"><FaUser /></div>
                    <div className="sms-info">
                      <div className="sms-name">Контакт {contact.slice(-6)}</div>
                      <div className="sms-preview">{isMe ? 'Вы: ' : ''}{last.decryptedContent?.slice(0, 40)}...</div>
                    </div>
                    <div className="sms-time">
                      {new Date(last.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="message-form">
        <div className="input-group">
          <input
            type="text"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            placeholder="ID получателя"
          />
          <button onClick={send} disabled={!newMessage.trim() || !targetId}>
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
        Место Встречи © 2025 • Mesh • Без интернета
      </footer>
    </div>
  );
};

export default App;