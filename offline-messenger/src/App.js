// src/App.js
import React, { useState, useEffect } from 'react';

// Сервисы
import { initPeer, sendMessage } from './services/peerService';
import { addMessage, getMessageQueue, removeMessage } from './services/messageQueue';
import { decryptMessage, encryptMessage } from './utils/crypto';
import { getDeviceId } from './utils/deviceId';

const App = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [targetId, setTargetId] = useState('');
  const MY_DEVICE_ID = getDeviceId();
  let peerInstance = null;

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
    console.log('Получено:', data);

    // Обработка ACK
    if (data.type === 'ACK') {
      if (data.to === MY_DEVICE_ID) {
        removeMessage(data.msgId);
        console.log(`✅ Сообщение ${data.msgId} доставлено`);
      }
      return;
    }

    const msg = { ...data }; // копируем

    if (msg.hopCount >= msg.maxHops) {
      console.log(`⛔ Лимит прыжков достигнут: ${msg.id}`);
      return;
    }

    msg.hopCount += 1;

    if (msg.to === MY_DEVICE_ID) {
      try {
        const decrypted = await decryptMessage(msg.content, 'mesh2025');
        const fullMsg = {
          ...msg,
          decryptedContent: decrypted,
        };
        addMessage(fullMsg);
        setMessages((prev) => [...prev, fullMsg]);
        sendAck(msg.id, msg.from);
      } catch (e) {
        console.error('❌ Ошибка расшифровки:', e);
        const errorMsg = {
          ...msg,
          decryptedContent: '(ошибка расшифровки)',
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } else {
      forwardMessage(msg);
    }
  };

  const sendMessageTo = async () => {
    if (!newMessage.trim() || !targetId) return;

    try {
      console.log('Шифруем:', newMessage);
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
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🔐 Mesh-Мессенджер (оффлайн)</h1>
      <p><strong>Твой ID:</strong> <code>{MY_DEVICE_ID}</code></p>

      <div style={{ margin: '20px 0' }}>
        <input
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          placeholder="ID получателя"
          style={{ width: '300px', padding: '8px', marginRight: '10px' }}
        />
        <br />
        <textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Введите сообщение..."
          rows="3"
          style={{ width: '300px', padding: '8px', margin: '10px 0' }}
        />
        <br />
        <button onClick={sendMessageTo} style={{ padding: '10px 20px' }}>
          Отправить
        </button>
      </div>

      <h2>📬 Сообщения</h2>
      {messages.length === 0 ? (
        <p>Нет сообщений</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {messages.map((msg) => (
            <li
              key={msg.id}
              style={{
                border: '1px solid #ddd',
                margin: '8px 0',
                padding: '12px',
                borderRadius: '6px',
                backgroundColor: msg.to === MY_DEVICE_ID ? '#e6f7ff' : '#f9f9f9',
                maxWidth: '80%',
              }}
            >
              <small style={{ color: '#555' }}>
                От: {msg.from} → Кому: {msg.to} | {new Date(msg.timestamp).toLocaleTimeString()}
              </small>
              <p style={{ margin: '6px 0 0', fontWeight: '500', wordBreak: 'break-word' }}>
                {msg.decryptedContent || '(зашифровано)'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default App;