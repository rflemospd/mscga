import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const baseFromEnv = process.env.VITE_BASE;
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const computedBase = repoName ? `/${repoName}/` : '/';

export default defineConfig({
  plugins: [react()],
  base: baseFromEnv || computedBase,
});
