// utils/crypto.js
export const encryptMessage = async (message, key) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(key));
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data
  );
  return {
    data: Array.from(new Uint8Array(encrypted)),
    iv: Array.from(iv),
  };
};

export const decryptMessage = async (encrypted, key, iv) => {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) },
    cryptoKey,
    new Uint8Array(encrypted)
  );
  return new TextDecoder().decode(decrypted);
};