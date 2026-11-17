# Narração privada do mestre

A implementação mantém as mensagens individuais no servidor, com destino vinculado à identificação do jogador. Consultas HTTP, sincronização e eventos SSE filtram o conteúdo antes de enviá-lo. A personalização não altera as permissões. Mensagens pendentes sobrevivem a reinícios e a leitura só é confirmada explicitamente.

## Referências consultadas

- [Theatre Inserts, catálogo oficial do Foundry](https://foundryvtt.com/packages/theatre/): apresentação inspirada em visual novels e texto animado. Referência para a revelação gradual e o tratamento teatral da mensagem.
- [Narrator Tools, catálogo oficial do Foundry](https://foundryvtt.com/packages/narrator-tools/): narração sobre a tela e fundo escurecido para cenas. Referência para a separação visual entre a narração e a mesa.
- [Histórico do Narrator Tools, repositório do autor](https://github.com/elizeuangelo/fvtt-module-narrator-tools/blob/master/releases.md): personalização de fontes e cores. Referência para controles explícitos de aparência.
- [Segue, repositório do autor](https://github.com/north-aok/foundry-vtt-segue): apresentações cinematográficas com configuração de fonte, cor, tamanho e velocidade. Referência complementar para os controles do mestre.

Os padrões acima foram adaptados com código próprio; nenhum módulo externo é necessário. A decisão para a Forja é uma janela central individual, com reconhecimento de leitura e sem duração automática: a narração não desaparece antes de o jogador terminar.

## Comportamento

O mestre escolhe uma atmosfera inicial e pode ajustar texto, fundo, destaque, fonte, tamanho, alinhamento e velocidade. O formulário tem prévia ao editar e prévia completa, usando o mesmo componente e a mesma animação do destinatário. Prévia nunca envia mensagens nem confirma leitura. O servidor aceita apenas cores hexadecimais e opções enumeradas, exige contraste do texto e do destaque com o fundo e persiste o estilo junto com a mensagem.

A animação respeita grafemas (acentos e emojis compostos), pausa brevemente na pontuação e pode ser pulada. Sincronizações repetidas não reiniciam o texto. Quando a aba fica oculta, a animação pausa e continua ao retornar. Reduzir movimento apresenta o texto completo. Leitores de tela recebem o texto de uma vez, sem anúncios a cada caractere. A janela usa o diálogo nativo para permanecer centralizada e visível inclusive quando há outro editor aberto, com foco e teclado administrados pelo navegador.

Mensagens antigas sem estilo usam texto instantâneo. A aparência gravada continua acompanhando a mensagem após reconectar. A preferência local de estilo do mestre só define os próximos envios; não altera mensagens já entregues.

## Verificação

`npm test` cobre entrega privada em HTTP/SSE, validação de estilo, recusa de CSS arbitrário e contraste ruim, grafemas, deduplicação, prévia, redução de movimento, confirmação e falha de rede. `npm run build` inclui os novos arquivos no Worker; `./scripts/build-linux.sh` inclui os módulos no executável Linux.

## Correção de repetição na sincronização

As consultas leves de áudio agora carregam o identificador do personagem. O cliente também conserva o destinatário quando recebe uma resposta parcial de versões anteriores que omite esse campo, sem tratar a omissão como troca de personagem. Assim, atualizações de áudio, snapshots completos e SSE não reiniciam o mesmo texto nem a animação de escrita. A identificação explicitamente removida continua apagando a mensagem da tela.

Ao confirmar a leitura, a fila espera concluir a confirmação antes de abrir a próxima mensagem. Isso impede que a resposta da API abra a próxima narração e o final do processamento a reinicie. Uma falha na confirmação mantém a possibilidade de tentar novamente. Há regressões em `tests/narration-inline-client.test.mjs` para os dois casos, além da verificação do destinatário no sync em `tests/campaign-tools.test.mjs`.
