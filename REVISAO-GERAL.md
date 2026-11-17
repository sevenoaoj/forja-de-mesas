# Revisão geral — 17/11/2026

Revisão de código e execução da suíte existente, com foco em API, persistência, permissões, uploads, backups, sincronização e empacotamento. Não constitui auditoria exaustiva ou medição de carga em produção.

## Correções aplicadas

| Achado | Efeito | Correção |
| --- | --- | --- |
| JSON era lido integralmente sem limite durante o streaming. | Um corpo grande, inclusive sem Content-Length, podia consumir memória antes da validação. | Leitor compartilhado com teto de 1.500.000 bytes; prévias limitadas a 2.048 bytes; interrupção do corpo excessivo com HTTP 413. |
| Corpos JSON primitivos e envelopes de ação inválidos chegavam à lógica interna. | Alguns formatos retornavam HTTP 500 em vez de erro de entrada. | Exigir objeto JSON e validar tipo de ação e objeto de dados, retornando HTTP 400. |
| Cada aba recalculava e serializava a projeção SSE durante uma publicação. | Trabalho repetido para abas com o mesmo acesso e cena. | Reutilizar projeção e bytes somente dentro da mesma publicação e identidade/cena; manter isolamento entre jogadores. |
| A fila SSE era controlada por quantidade de mensagens. | Poucas dezenas de snapshots grandes podiam reter muita memória por cliente lento. | Medir a fila em bytes e encerrar clientes que ultrapassam o orçamento de 12 MB ao tentar o próximo envio. O orçamento pode ser excedido por um último evento completo. |
| Uma conexão com sinal já abortado criava timer sem salas ativas. | Timer residual, mesmo sem clientes. | Iniciar manutenção somente quando houver salas. |
| O diálogo registrava duas vezes eventos da aparência de tokens. | Recriação duplicada da prévia e chamadas repetidas de atualização de retratos. | Remover registros duplicados, preservando os eventos específicos de outros formulários. |

O módulo novo `request-json.mjs` foi incluído nos empacotamentos do Worker e Linux. `AGENTS.md` registra a estrutura e os cuidados para próximas alterações.

## Validação

- Suíte completa: 342 testes, 339 aprovados, zero falhas, três pulados por restrições de subprocessos/portas TCP do ambiente.
- Cinco testes novos verificam limites em streams, entradas malformadas, ausência de gravações rejeitadas, reutilização de snapshots sem vazamento entre jogadores, descarte de cliente lento e encerramento do timer.
- `npm run build`: concluído; importação do Worker gerado e resposta da página inicial verificadas.
- `server.mjs --check`: runtime, arquivos e SQLite verificados com diretório temporário.
- Sintaxe JavaScript dos arquivos de entrada alterados e sintaxe shell do empacotador verificadas. O executável Linux não foi reconstruído.

## Pontos ainda a acompanhar

- `public/app.mjs` consulta o sync de áudio a cada 400 ms e a campanha a cada 2,5 s. `storage.mjs` decodifica o estado completo em cada leitura. Medir CPU, tráfego e latência com campanhas grandes antes de modificar intervalos ou particionar o armazenamento.
- `sceneView` ainda monta uma visão completa antes de selecionar os campos da mesa. Há espaço para uma projeção específica, mas ela precisa preservar todos os filtros de dados privados.
- `server.mjs` relê arquivos estáticos a cada requisição e não implementa ETag. Cache com invalidação merece medição separada, considerando uso local e atualização de arquivos.
- Os mapas explícitos de arquivos em servidor, Worker e empacotador Linux exigem manutenção sincronizada; uma fonte comum reduziria o risco de omissões.
- Validar os três testes pulados em ambiente com rede e subprocessos liberados; testar sessões prolongadas e clientes móveis lentos para complementar os testes simulados.
