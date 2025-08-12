// utils/meshSimulator.js
const CHANNEL_NAME = 'mesh-messenger';
const channel = new BroadcastChannel(CHANNEL_NAME);

export class MeshNetwork {
  constructor(onMessage) {
    this.onMessage = onMessage;
    channel.onmessage = (event) => {
      const msg = event.data;
      if (msg.target && msg.target !== this.getDeviceId() && msg.hopCount > 0) {
        // Пересылаем дальше
        this.forwardMessage(msg);
      }
      if (msg.target === this.getDeviceId()) {
        // Это наше сообщение
        this.onMessage(msg);
      }
    };
  }

  getDeviceId() {
    return localStorage.getItem('deviceId');
  }

  sendMessage(content, targetId, ttl = 5) {
    const message = {
      id: 'msg_' + Math.random().toString(36).substr(2, 9),
      from: this.getDeviceId(),
      to: targetId,
      content,
      hopCount: ttl,
      timestamp: Date.now(),
      seenBy: [this.getDeviceId()], // кто уже получил
    };
    channel.postMessage(message);
  }

  forwardMessage(msg) {
    // Уменьшаем TTL
    msg.hopCount -= 1;
    msg.seenBy.push(this.getDeviceId());
    // Рассылаем дальше
    channel.postMessage(msg);
  }

  sendAck(messageId, recipient) {
    channel.postMessage({
      type: 'ACK',
      messageId,
      from: this.getDeviceId(),
      to: recipient,
    });
  }
}