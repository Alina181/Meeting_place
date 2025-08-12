import React, { useState, useEffect } from 'react';
import { getDeviceId } from './utils/deviceId';
import { MeshNetwork } from './utils/meshSimulator';
import { messageQueue } from './utils/messageQueue';
import MessageList from './components/MessageList';
import SendMessage from './components/SendMessage';

function App() {
  const [messages, setMessages] = useState([]);
  const [deviceId] = useState(getDeviceId());
  const [network] = useState(new MeshNetwork((msg) => {
    setMessages(prev => [...prev, msg]);
    // Отправляем ACK, если это наше сообщение
    network.sendAck(msg.id, msg.from);
    // Удаляем из очереди, если это ответ на наше
    messageQueue.remove(msg.id);
  }));

  return (
    <div style={{ padding: 20 }}>
      <h2>Mesh Messenger</h2>
      <p><strong>Ваш ID:</strong> {deviceId}</p>
      <SendMessage network={network} />
      <MessageList messages={messages} />
    </div>
  );
}

export default App;