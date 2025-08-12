// utils/messageQueue.js
class MessageQueue {
  constructor() {
    this.messages = JSON.parse(localStorage.getItem('outbox') || '[]');
  }

  add(message) {
    this.messages.push(message);
    this.save();
  }

  remove(messageId) {
    this.messages = this.messages.filter(m => m.id !== messageId);
    this.save();
  }

  save() {
    localStorage.setItem('outbox', JSON.stringify(this.messages));
  }

  getAll() {
    return this.messages;
  }
}

export const messageQueue = new MessageQueue();