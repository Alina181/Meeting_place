export const addMessage = (msg) => {
  const q = JSON.parse(localStorage.getItem('mesh_queue') || '[]');
  if (q.some(m => m.id === msg.id)) return;
  q.push(msg);
  localStorage.setItem('mesh_queue', JSON.stringify(q));
};

export const getMessageQueue = () => {
  return JSON.parse(localStorage.getItem('mesh_queue') || '[]');
};

export const updateMessageStatus = (id, status) => {
  const q = JSON.parse(localStorage.getItem('mesh_queue') || '[]');
  const updated = q.map(m => m.id === id ? { ...m, status } : m);
  localStorage.setItem('mesh_queue', JSON.stringify(updated));
};

export const removeMessage = (id) => {
  const q = JSON.parse(localStorage.getItem('mesh_queue') || '[]');
  const filtered = q.filter(m => m.id !== id);
  localStorage.setItem('mesh_queue', JSON.stringify(filtered));
};