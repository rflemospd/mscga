import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Role = 'grandes_contas' | 'farma' | 'admin';

type InputUser = {
  username: string;
  role: Role;
  password: string;
};

type OutputUser = {
  username: string;
  role: Role;
  salt: string;
  iterations: number;
  hash: string;
  hashAlg: 'SHA-256';
  dkLen: number;
};

const iterations = 310000;
const dkLen = 32;
const inputPath = resolve('scripts/users-input.json');
const outputPath = resolve('public/users.json');

function validateInput(users: InputUser[]): void {
  const usernames = new Set<string>();
  for (const user of users) {
    if (!user.username || !user.password) {
      throw new Error('Todos os usuários precisam de username/password.');
    }
    if (usernames.has(user.username)) {
      throw new Error(`Username duplicado: ${user.username}`);
    }
    usernames.add(user.username);
  }
}

function main(): void {
  const users = JSON.parse(readFileSync(inputPath, 'utf8')) as InputUser[];
  validateInput(users);

  const output: OutputUser[] = users.map((user) => {
    const salt = randomBytes(16);
    const hash = pbkdf2Sync(user.password, salt, iterations, dkLen, 'sha256');

    return {
      username: user.username,
      role: user.role,
      salt: salt.toString('base64'),
      iterations,
      hash: hash.toString('base64'),
      hashAlg: 'SHA-256',
      dkLen,
    };
  });

  writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Arquivo gerado em ${outputPath} com ${output.length} usuários.`);
}

main();
