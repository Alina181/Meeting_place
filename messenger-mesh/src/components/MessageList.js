import React from 'react';

export default function MessageList({ messages }) {
  return (
    <div>
      <h3>Полученные сообщения</h3>
      {messages.length === 0 ? (
        <p>Нет сообщений</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {messages.map(msg => (
            <li key={msg.id} style={{ border: '1px solid #ccc', margin: '5px 0', padding: 10 }}>
              <strong>От:</strong> {msg.from} <br />
              <strong>Кому:</strong> {msg.to} <br />
              <em>{msg.content}</em> <br />
              <small>{new Date(msg.timestamp).toLocaleString()}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}