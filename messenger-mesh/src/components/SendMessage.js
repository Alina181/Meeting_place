import React, { useState } from 'react';

export default function SendMessage({ network }) {
  const [content, setContent] = useState('');
  const [target, setTarget] = useState('');

  const send = () => {
    if (!content || !target) return;
    network.sendMessage(content, target);
    setContent('');
  };

  return (
    <div>
      <input
        placeholder="ID получателя"
        value={target}
        onChange={e => setTarget(e.target.value)}
        style={{ width: '100%', marginBottom: 10 }}
      />
      <textarea
        placeholder="Сообщение"
        value={content}
        onChange={e => setContent(e.target.value)}
        style={{ width: '100%', height: 80 }}
      />
      <button onClick={send}>Отправить</button>
    </div>
  );
}