export const getDeviceId = () => {
  const stored = localStorage.getItem('deviceId');
  if (stored) return stored;

  const id = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem('deviceId', id);
  return id;
};