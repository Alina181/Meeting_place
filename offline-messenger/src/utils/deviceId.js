export const getDeviceId = () => {
  let id = localStorage.getItem('mesh_device_id');
  if (!id) {
    id = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('mesh_device_id', id);
  }
  return id;
};