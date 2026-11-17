# Revisão interna — 12/11/2026

A revisão priorizou o servidor local Linux e as diferenças de comportamento entre PC e celular. Foram examinados o armazenamento com controle de revisão, permissões de fichas e cenas, projeções públicas, o canal SSE, prévias de tokens, inicialização Linux e os testes correspondentes.

## Problemas confirmados e correções

| Prioridade | Problema reproduzido | Correção |
| --- | --- | --- |
| Alta | `table-realtime.mjs`, `commitToken`: ao concluir um movimento, o cancelamento da prévia chegava antes do snapshot persistido. O cliente podia restaurar a posição antiga por um instante. | O commit retira a prévia dos movimentos ativos, entrega primeiro o snapshot e só então libera a prévia. Há regressão para posicionamento novo e para arrastar de volta à mesma posição. |
| Média | `access.mjs`, `rollView`: o filtro legado por nome também era aplicado às rolagens com `characterId`. Um personagem visível que tivesse o mesmo nome de uma ficha oculta perdia suas rolagens públicas. | Priorizar o identificador da ficha; consultar o nome somente quando o registro antigo não contém identificador. Correção coordenada com a integração principal. |
| Média | `public/table-live.mjs`, `open`: receber headers HTTP 200 zerava o atraso progressivo, mesmo se o stream fechasse imediatamente. Falhas repetidas tentavam novamente a cada 500 ms. | O atraso só reinicia após o stream permanecer conectado por pelo menos 10 segundos. Os testes usam relógio controlado e verificam 500/1000/2000 ms, além da recuperação posterior. |
| Média | `public/table-live.mjs`, `createEventDecoder`: o limite de 12 milhões de caracteres só contava o fragmento sem quebra de linha. Linhas `data:` já consumidas podiam acumular um evento ilimitado. | Contabilizar também o conteúdo acumulado do evento até sua linha vazia de conclusão. O teste reproduz o excesso por muitas linhas pequenas. |
| Média | `public/table-live.mjs`, `open`: um erro de decodificação liberava o reader, mas não abortava o fetch antigo antes da reconexão. Isso podia manter uma conexão órfã no servidor. | Encerrar o controller no bloco de finalização de cada stream. Um teste reproduz o erro com stream maior que o limite e exige o cancelamento da requisição antiga. |

Os quatro novos testes de sincronização/decodificação/reconexão falharam antes das respectivas correções. Um quinto teste cobre a chegada de um commit depois de uma publicação mais recente: a liberação da prévia usa o snapshot atual, sem rebaixar a revisão nem aguardar outra mutação. Após as correções, `node tests/table-live.test.mjs` passou com 9 testes e `node tests/table-realtime.test.mjs` passou com 14 testes. Os testes de visibilidade, propriedade, névoa, conexão simultânea e reconexão continuaram passando. Também passaram os 36 testes de `table-ui` e os 8 de cenas, que exercitam a posição canônica no cliente, privacidade das cenas e ativação pública.

## Contratos preservados

- A névoa encobre visualmente os tokens; sua posição continua sendo sincronizada. A ocultação explícita do mestre retira o token da projeção pública e interrompe prévias públicas sem coordenadas.
- Cenas de preparação continuam privadas do mestre. Jogadores recebem a cena ativada, sem mapas de outras cenas.
- O servidor persiste a posição final antes de transmiti-la. Prévia não grava o banco, expira e não ressuscita depois do commit.
- O snapshot persistido continua sendo a referência ao reconectar. O canal SSE não substitui as verificações de acesso nem o controle de revisão.

## Atenções para as novas funções

Histórico/restauração, modelos de ficha e diário devem passar pelo mesmo ciclo de autorização, CAS e projeção pública. Histórico deve aparecer apenas junto da ficha completa autorizada; modelos não devem transportar dono, visibilidade, identificação, retrato privado ou referências de campanha; documentos seletivos precisam ser filtrados novamente a cada leitura, incluindo depois de mudar o dono ou ocultar a ficha.

Foram integrados orçamentos agregados: histórico de 384 KiB, modelos de 384 KiB e diário de 512 KiB. O limite geral de `storage.mjs` continua prevalecendo sobre a soma dessas ferramentas com os outros dados da campanha; uma rejeição de tamanho mantém o estado anterior intacto. Os snapshots SSE da mesa transportam somente marcadores filtrados de diário/modelos, sem seus documentos ou estruturas completas.

A revisão final não encontrou falha material adicional nos wrappers de autorização, captura/restauração ou projeção pública. O teste integrado do cliente cobre salvar modelo, aplicá-lo a uma ficha, abrir o histórico e restaurar valores sem alterar permissões; também cria um documento privado, publica e recolhe pela interface. O controller do histórico tem três testes específicos, incluindo versão numérica, resumo sem acesso e perda de propriedade. O relatório da integração principal registra a suíte completa e a validação do executável Linux.

Não houve comprovação de corrupção de banco ou vazamento de fichas na inspeção inicial. Essa conclusão descreve somente os caminhos examinados; não substitui um teste manual com dispositivos reais.
