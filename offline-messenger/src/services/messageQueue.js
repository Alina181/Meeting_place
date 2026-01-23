export const addMessage = (msg) => {
  const queue = JSON.parse(localStorage.getItem('messageQueue') || '[]');
  if (queue.some(m => m.id === msg.id)) return;
  queue.push(msg);
  localStorage.setItem('messageQueue', JSON.stringify(queue));
};

export const removeMessage = (msgId) => {
  const queue = JSON.parse(localStorage.getItem('messageQueue') || '[]');
  const filtered = queue.filter(m => m.id !== msgId);
  localStorage.setItem('messageQueue', JSON.stringify(filtered));
};

export const updateMessageStatus = (msgId, status) => {
  const queue = JSON.parse(localStorage.getItem('messageQueue') || '[]');
  const updated = queue.map(m => m.id === msgId ? { ...m, status } : m);
  localStorage.setItem('messageQueue', JSON.stringify(updated));
};

export const getMessageQueue = () => {
  return JSON.parse(localStorage.getItem('messageQueue') || '[]');
};