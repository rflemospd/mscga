# MSCGA - SPA estática com gate de acesso (GitHub Pages)

Site SPA em **Vite + React + TypeScript**, com autenticação client-side por usuário/senha, sessão curta e RBAC por perfil.

## ⚠️ Limitações de Segurança no GitHub Pages (obrigatório ler)

GitHub Pages é hospedagem **estática**, sem backend para validar credenciais em servidor e sem autenticação nativa de app por rota.
Isso significa que **não existe segurança real para segredos no frontend**: qualquer pessoa pode inspecionar JS, requests e arquivos públicos.

Neste projeto, o login é um **gate de baixo risco/uso interno**, não um controle robusto contra atacante dedicado.

Medidas implementadas para elevar o nível mínimo:
- Senhas não ficam em texto puro no repositório.
- `public/users.json` guarda apenas hash PBKDF2-SHA-256 + salt + parâmetros.
- Comparação em tempo constante aproximado em JS.
- Sessão em `sessionStorage` com expiração por inatividade (30 min) e hard timeout (8 h).
- Backoff progressivo local após tentativas de login inválidas.

## Funcionalidades

- Login em `/#/login` com mensagens genéricas (`Credenciais inválidas`).
- Usuários pré-definidos apenas pelo usuário mestre (fora da UI).
- Perfis: `viewer`, `ops`, `admin`.
- Rotas protegidas com guardas:
  - `/#/home` (todos autenticados)
  - `/#/info` (todos autenticados)
  - `/#/restricted` (ops/admin)
  - `/#/admin` (admin)
  - `/#/denied` para acesso sem permissão
- Header com usuário logado, role, último login, expira em X minutos e logout.

## Como provisionar usuários

1. Copie o exemplo para um arquivo local **não versionado**:

```bash
cp scripts/users-input.example.json scripts/users-input.json
```

2. Edite `scripts/users-input.json` com:

```json
[
  { "username": "usuario1", "role": "viewer", "password": "senha-forte" },
  { "username": "usuario2", "role": "ops", "password": "senha-forte" },
  { "username": "usuario3", "role": "admin", "password": "senha-forte" }
]
```

3. Gere o `public/users.json`:

```bash
npm run provision
```

4. Faça commit **somente** do `public/users.json` gerado (nunca do input com senha).

### Revogar usuário

- Remova o usuário do `scripts/users-input.json`.
- Rode `npm run provision` novamente.
- Commit/push do novo `public/users.json`.

## Rodando localmente

```bash
npm ci
npm run dev
```

## Build

```bash
npm run build
```

## Deploy no GitHub Pages

Workflow em `.github/workflows/deploy.yml`:
- instala dependências com `npm ci`
- roda `npm run build`
- publica artifact em GitHub Pages

### Configuração do repositório

1. Em **Settings > Pages**, selecione **GitHub Actions** como source.
2. Faça push na branch `main`.
3. A URL publicada ficará em `https://<user>.github.io/<repo>/`.

> O `vite.config.ts` define `base` automaticamente no CI usando `GITHUB_REPOSITORY`.

## Credenciais de exemplo fracas (somente demo)

O repositório inclui `public/users.json` gerado com senhas fracas (`viewer123`, `ops123`, `admin123`) apenas para demonstração.
**Troque imediatamente** em qualquer uso real.

## Estrutura

```txt
src/
  auth/
  pages/
scripts/
public/users.json
.github/workflows/deploy.yml
```
