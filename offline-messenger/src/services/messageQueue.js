// src/services/messageQueue.js
let messageQueue = JSON.parse(localStorage.getItem('messageQueue') || '[]');

export const addMessage = (msg) => {
  if (messageQueue.some((m) => m.id === msg.id)) return;
  messageQueue.push(msg);
  saveToStorage();
};

export const removeMessage = (msgId) => {
  messageQueue = messageQueue.filter((m) => m.id !== msgId);
  saveToStorage();
};

export const getMessageQueue = () => messageQueue;

const saveToStorage = () => {
  localStorage.setItem('messageQueue', JSON.stringify(messageQueue));
};