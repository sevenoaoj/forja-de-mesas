# Orientações do projeto

## Estrutura e execução

- Aplicativo de RPG em português, com JavaScript ESM e Node.js >=22.13, sem dependências npm externas.
- `server.mjs`: servidor HTTP local e SQLite nativo. `api.mjs`: API compartilhada entre servidor e Worker.
- `*-model.mjs`, `model.mjs` e `access.mjs`: regras, normalização e permissões. `public/`: interface sem framework.
- `table-realtime.mjs`: SSE local e prévias transitórias. O Worker usa consultas periódicas como alternativa.
- `drizzle/0001_campaigns.sql`: esquema SQLite. `storage.mjs`: persistência com revisão otimista.

## Validação

- Execute `npm test` após mudanças de comportamento. Os testes usam `node:test`; cada arquivo também pode ser executado diretamente com Node.
- Execute `npm run build` para validar o pacote do Worker.
- Para verificar runtime, arquivos e SQLite sem tocar nas campanhas, use `FORJA_DATA_DIR` apontando para um diretório temporário e execute `node server.mjs --check`.
- Testes que dependem de portas TCP ou subprocessos podem ser pulados em ambientes restritos; relate essa limitação.

## Cuidados nas alterações

- Preserve campanhas antigas e a separação entre mestre, convite e jogador. Filtre dados privados em respostas completas, sync, SSE e assets.
- Preserve verificações de revisão e permissões durante novas tentativas de gravação concorrente.
- Limite leituras de corpos por bytes durante o streaming; não confie apenas em `Content-Length`.
- Ao adicionar módulos usados pelo servidor, atualize as listas explícitas em `build.mjs` e `scripts/build-linux.sh` quando aplicável. Módulos servidos ao navegador também precisam constar nos mapas de arquivos.
- Não altere bancos reais, backups, `.recovery/`, credenciais ou executáveis em `releases/` durante validações de código.
- A interface e as mensagens ao usuário devem permanecer em português. Siga o estilo ESM existente e evite dependências novas sem necessidade.
