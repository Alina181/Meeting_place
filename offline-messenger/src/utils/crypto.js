// src/utils/crypto.js
const ENCRYPTION_KEY_LENGTH = 256; // AES-256
const SALT = 'mesh_network_salt_2025'; // Общая соль для всех устройств

export const encryptMessage = async (text, password) => {
  const encoder = new TextEncoder();
  const keyMaterial = await getKeyMaterial(password);
  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(SALT),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: ENCRYPTION_KEY_LENGTH },
    false,
    ['encrypt']
  );

  const data = encoder.encode(text);
  const iv = crypto.getRandomValues(new Uint8Array(12)); // AES-GCM IV = 12 байт
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    data
  );

  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
  };
};

export const decryptMessage = async (encrypted, password) => {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const keyMaterial = await getKeyMaterial(password);
  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(SALT),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: ENCRYPTION_KEY_LENGTH },
    false,
    ['decrypt']
  );

  const iv = new Uint8Array(
    atob(encrypted.iv)
      .split('')
      .map((c) => c.charCodeAt(0))
  );
  const ciphertext = new Uint8Array(
    atob(encrypted.ciphertext)
      .split('')
      .map((c) => c.charCodeAt(0))
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    ciphertext
  );

  return decoder.decode(decrypted);
};

async function getKeyMaterial(password) {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  return await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
}