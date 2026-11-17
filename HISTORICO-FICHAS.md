# Histórico privado de fichas

O histórico registra alterações efetivamente salvas de nome, conceito, cor, campos, valores, recursos, perícias, habilidades, fórmulas, maestrias, configuração de sistema e organização visual. Rolagens comuns não criam entradas; o consumo de maestria e recursos de magia cria, assim como a recuperação de recursos. Alterações no modelo compartilhado registram somente fichas cujo conteúdo efetivo mudou.

A ficha mostra resumos legíveis, autor e data. Ao restaurar uma entrada, recupera-se o conteúdo **imediatamente anterior àquela alteração**, inclusive alterações posteriores que serão substituídas. A própria restauração cria uma nova entrada contendo o estado abandonado; ela pode ser desfeita da mesma maneira.

## Permissões e limites

Somente o dono atual de uma ficha visível e o mestre podem restaurá-la. A projeção pública existente envia o histórico completo apenas ao dono e ao mestre; outros participantes recebem apenas o resumo de personagem. Nenhuma chave de convite ou identificador de posse é guardado na cópia.

A restauração preserva o retrato atual, o dono e a visibilidade. Fotos apagadas não reaparecem, nem são recriadas referências a arquivos antigos. A estrutura restaurada se torna própria daquela ficha: recuperar um modelo compartilhado antigo não muda o modelo da campanha nem outras fichas.

Não há migração ou recuperação retroativa de alterações anteriores à implantação. A criação de personagem e mudanças de retrato, posse ou visibilidade não geram entradas restauráveis. Excluir uma ficha exclui também seu histórico; isto não funciona como lixeira.

Retenção máxima: 20 entradas por ficha, cópia individual de até 64 KiB, histórico de até 96 KiB por ficha e 384 KiB somados por campanha (JSON em UTF-8). Ao atingir o orçamento, as cópias mais antigas expiram antes dos resumos; uma ficha maior que 64 KiB continua podendo ser editada, mas sua entrada informa que não há cópia restaurável. Esses limites impedem crescimento ilimitado do estado e não substituem backup do servidor.

## Contrato de integração

Módulo puro: `sheet-history.mjs`.

```js
// Dentro de cada tentativa transacional, depois da autorização:
const captured = captureSheetChanges(state, action, data, access);
if (!mutateSheetHistory(state, action, data, access)) {
  mutateExistingAction(state, action, data, access);
  recordSheetChanges(state, captured, {action});
}
```

`isSheetHistoryRelevant(action)` permite ignorar trabalho adicional para ações de mesa/áudio. `captureSheetChanges` já faz essa verificação e não copia fichas em rolagens sem maestria. Inclui `sheetTemplateApply` para reaplicar um modelo universal em personagem existente. Não guarda estado completo da campanha e não grava no disco; o chamador persiste a transação normalmente. Não registrar a restauração novamente pelo wrapper: ela grava sua própria revisão.

A ação `sheetHistoryRestore` recebe `{id, entryId, expectedVersion}`. `expectedVersion` é um número inteiro igual a `character.sheetHistory.version` recebido na última leitura; divergência retorna 409 antes de qualquer mutação. A autorização própria/mestre é novamente verificada no módulo. O roteador deve aceitar a ação para jogadores autenticados com ficha própria e continuar aplicando a proteção a visitantes. A restauração também incrementa `appearance.version`, invalidando rascunhos de organização que estavam abertos.

Interface: `public/sheet-history.mjs` exporta `renderSheetHistory(character)` e `renderSheetHistoryRestore(character, entryId)`. O primeiro emite botões `data-act="sheetHistoryRestore"`, `data-id` do personagem e `data-entry` da alteração; o segundo emite formulário `data-form="sheetHistoryRestore"` com `id`, `entryId` e `expectedVersion`. O chamador converte `expectedVersion` de string para número ao enviar. CSS: `public/sheet-history.css`. Ambos evitam renderizar detalhes de uma ficha marcada `access: 'summary'`.

Validação: `node tests/sheet-history.test.mjs` verifica autorização, projeção privada, conflitos de versão, restauração reversível, preservação do retrato e acesso, campos compartilhados, maestrias, retenção por ficha/campanha e escape da interface.
