const PASSWORD = 'Место Встречи 2025';
const SALT = 'mesh_salt_2025_place_of_meet';

export const encryptMessage = async (text) => {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(PASSWORD),
    { name: 'PBKDF2' }, false, ['deriveKey']
  );

  const aesKey = await crypto.subtle.deriveKey({
    name: 'PBKDF2', salt: encoder.encode(SALT),
    iterations: 100000, hash: 'SHA-256'
  }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);

  const data = encoder.encode(text);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, data);

  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv))
  };
};

export const decryptMessage = async (obj) => {
  try {
    const decoder = new TextDecoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(PASSWORD),
      { name: 'PBKDF2' }, false, ['deriveKey']
    );

    const aesKey = await crypto.subtle.deriveKey({
      name: 'PBKDF2', salt: new TextEncoder().encode(SALT),
      iterations: 100000, hash: 'SHA-256'
    }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);

    const iv = new Uint8Array(atob(obj.iv).split('').map(c => c.charCodeAt(0)));
    const ciphertext = new Uint8Array(atob(obj.ciphertext).split('').map(c => c.charCodeAt(0)));

    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext);
    return decoder.decode(decrypted);
  } catch {
    return '(ошибка)';
  }
};