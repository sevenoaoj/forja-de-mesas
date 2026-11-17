# Diário e documentos da campanha

O diário organiza anotações, inventário, pistas, personagens, locais e missões. Jogadores identificados com personagem podem criar seus próprios registros e editar, compartilhar ou excluir apenas os que escreveram. Registros privados dos jogadores são visíveis ao autor e ao mestre. O mestre prepara o conteúdo em texto simples, mantém um segredo separado e escolhe quem pode ler cada documento. Missões podem estar em andamento ou concluídas.

Um documento novo do mestre começa **Só mestre**; o de um jogador começa **Autor e mestre**. “Mostrar a todos” compartilha o conteúdo com os jogadores identificados da campanha. Também é possível selecionar personagens: a autorização acompanha quem controla aquela ficha. Personagens ocultos não podem ser escolhidos e não recebem documentos dessa seleção. Ao recolher um documento, ele desaparece do estado enviado aos demais jogadores; aquilo que já foi lido ou copiado não pode ser desfeito.

O mestre pode buscar por conteúdo, título ou segredo. Jogadores buscam apenas no conteúdo que receberam. Recolher/expandir um cartão é uma preferência local de leitura e não altera suas permissões. Documentos não abrem janelas automaticamente na mesa para evitar interromper uma ação em curso.

## Contrato de integração

- Persistência: `state.journal`, vetor inicializado sob demanda; campanhas existentes não precisam de migração.
- `journalView(state,access)` devolve uma cópia integral para o mestre e uma projeção explícita de campos seguros para o jogador. Convidados sem identidade recebem uma lista vazia. Notas privadas do mestre nunca são enviadas aos jogadores. O autor recebe os destinatários e a política de compartilhamento do próprio registro para poder editá-los; outros leitores recebem apenas o conteúdo seguro.
- `mutateJournal(state,action,data,access)` devolve `false` para ações desconhecidas. O mestre pode executar as ações sobre qualquer documento; um jogador só sobre os próprios: `journalSave`, `journalPublish`, `journalStatus`, `journalDelete`.
- Atualizações e exclusões exigem `id` e a `version` atual. Uma divergência retorna 409, preservando a versão mais recente. Compartilhar, recolher e concluir também incrementam a versão.
- `journalSave`: `{id?,version?,title,kind,body,gmNotes,audience,recipientIds,status}`. Categorias: `note/item/clue/character/place/quest`. Público: `private/all/selected`. Destinatários: IDs estáveis de personagens visíveis. Estado: `active/completed` (somente missões).
- `journalPublish`: `{id,version,audience,recipientIds?}`. `journalStatus`: `{id,version,status}`. `journalDelete`: `{id,version}`.
- Limites: 512 KiB agregados em UTF-8; 200 documentos, título 120 caracteres, conteúdo 16.000, segredo 8.000. Nenhum HTML é interpretado. O módulo de interface escapa texto.
- `public/journal.mjs`: `renderJournal(row,ui,view)`, `journalEditor(entry,row,ui)`, `journalFormData(formData)`, `visibleJournal(row,view)`.
- A aplicação deve remover o `journal` bruto antes de construir o estado público e aplicar `journalView` a cada destinatário, incluindo SSE, sincronizações e respostas de mutação. Filtrar somente na interface é insuficiente.

Referências a cenas privadas, anexos, editor HTML e notificações que abrem documentos em outras telas ficam fora desta entrega. A biblioteca de PDFs mantém seu comportamento atual.

## Inspiração e validação

O fluxo parte dos [Journals do Foundry](https://foundryvtt.com/article/journal/) e do [Journal do Roll20](https://help.roll20.net/hc/en-us/articles/360039675133-Journal): preparar documentos, organizar conhecimento e controlar quem recebe cada informação. A Forja usa uma estrutura menor e texto simples para preservar a facilidade de uso e sua natureza universal.

Execute `node --test tests/journal.test.mjs`. Os testes cobrem documento privado por padrão, seleção por posse de personagem, ausência de notas privadas no estado público, convidados, revogação, versões concorrentes, missões e escape de conteúdo na interface. A integração deve ser verificada também pelo `publicState`, além de testar o fluxo visual em mestre e jogador.
