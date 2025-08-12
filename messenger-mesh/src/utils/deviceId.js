// utils/deviceId.js
export const getDeviceId = () => {
  let id = localStorage.getItem('deviceId');
  if (!id) {
    id = 'device_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('deviceId', id);
  }
  return id;
};