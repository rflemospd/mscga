export type UserRecord = {
  username: string;
  role: 'grandes_contas' | 'farma' | 'admin';
  salt: string;
  iterations: number;
  hash: string;
  hashAlg: 'SHA-256';
  dkLen: number;
};

function b64ToBytes(input: string): Uint8Array {
  const decoded = atob(input);
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
}

export async function pbkdf2Hash(password: string, record: UserRecord): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const decodedSalt = b64ToBytes(record.salt);
  const salt = new Uint8Array(decodedSalt.byteLength);
  salt.set(decodedSalt);

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: record.hashAlg,
      salt,
      iterations: record.iterations,
    },
    key,
    record.dkLen * 8,
  );

  return new Uint8Array(bits);
}

export function timingSafeEqual(a: Uint8Array, b64: string): boolean {
  const b = b64ToBytes(b64);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}
