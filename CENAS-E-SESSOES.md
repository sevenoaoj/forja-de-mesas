# Cenas e sessões

Pesquisa e implementação: novembro de 2026.

## Referências e escolhas

| Referência oficial | Comportamento útil | Aplicação na Forja |
| --- | --- | --- |
| [Foundry — Scenes](https://foundryvtt.com/article/scenes/) e [Tutorial do mestre](https://foundryvtt.com/article/tutorial-two/) | Visualizar uma cena e ativá-la para jogadores são ações distintas. | **Preparar** abre privadamente para o mestre; **Mostrar à mesa** muda a cena pública. |
| [Owlbear — Scenes](https://docs.owlbear.rodeo/docs/scenes/) | Várias cenas, com um mapa por cena como fluxo comum. | Cada cena tem um mapa e sua própria composição de tokens, grade, névoa e desenhos. |
| [Owlbear — Assets](https://docs.owlbear.rodeo/docs/managing-assets/) | Coleções e pastas organizam a preparação. | Sessões agrupam cenas, com nome, data opcional e notas privadas. |
| [Roll20 — Creating Pages](https://roll20partners.zendesk.com/hc/en-us/articles/10269611754775-Creating-Pages-and-Adjusting-Page-Settings) | A página marcada para jogadores define o que eles veem. | A cena pública tem um marcador **Na mesa dos jogadores**, separado da cena aberta pelo mestre. |

Não reproduzimos a estrutura interna desses produtos; as referências orientam o fluxo de uso.

## Uso

Na **Mesa virtual**, o mestre encontra **Cenas e sessões** acima do mapa. Abra o painel para:

1. Criar uma sessão com nome, data e anotações privadas.
2. Criar uma cena nessa sessão, nomeá-la e anotar a preparação. A nova cena abre somente para o mestre.
3. Usar **Enviar mapa** e as ferramentas normais para posicionar tokens, configurar a grade, desenhar, preparar névoa e combate.
4. Clicar em **Mostrar à mesa** quando quiser levar os jogadores à cena preparada.
5. Abrir outra cena por **Preparar** ou retornar à cena pública sem alterar a visão dos jogadores.

Os cartões apresentam miniatura do mapa, nome, quantidade de tokens e indicadores de preparação/publicação. A busca considera nome e notas sem diferenciar acentos. É possível filtrar por sessão, mudar a ordem com ↑/↓ e mover uma cena para outra sessão no editor.

**Duplicar** cria uma cópia da composição para preparar variações ou reutilizar um local. O arquivo do mapa é compartilhado entre cópias, sem duplicar o arquivo no disco. Substituir o mapa de uma cópia não apaga o arquivo usado em outra. Apagar uma cena inativa remove seu arquivo apenas quando nenhuma outra cena o utiliza.

A cena atualmente pública não pode ser apagada: primeiro mostre outra. Uma sessão precisa estar vazia para ser removida e a campanha mantém pelo menos uma sessão. As exclusões usam a confirmação já existente no aplicativo.

## O que cada cena conserva

Mapa e calibração, tokens e suas posições/aparências, desenhos, configuração da grade, névoa e seu histórico, ordem/rodada de combate. Os pings são transitórios e são limpos ao ativar uma cena. A câmera se ajusta ao trocar de cena.

Fichas e seus recursos, livros, histórico de rolagens, música, soundboard e escudo do mestre permanecem da campanha. Uma sessão organiza a preparação; criar ou mudar de sessão não aplica descanso, não recupera PV e não renova maestrias automaticamente.

## Compatibilidade, acesso e sincronização

Uma campanha anterior aparece como uma primeira cena dentro de **Sessão 1**, preservando mapa, tokens e demais dados. Apenas consultar não grava uma migração. A coleção é persistida quando o mestre começa a organizá-la.

Os jogadores recebem somente a cena pública, seu nome e o nome da sessão correspondente. Catálogo, notas e dados de cenas preparadas ficam no servidor. O acesso ao arquivo de um mapa privado é autorizado apenas ao mestre; ao ativar essa cena, o mapa passa a ser acessível aos participantes.

O mestre recebe um resumo do catálogo e apenas o mundo da cena que está preparando, sem transferir todos os mapas e composições a cada sincronização. Sua conexão ao vivo é vinculada à cena aberta. Jogadores continuam vinculados à cena pública. Uma troca cancela arrastes transitórios e ações de jogadores originadas numa cena antiga são recusadas, inclusive quando as duas cenas reutilizam o mesmo mapa ou os mesmos IDs de tokens.

Formulários e envios de mapas carregam o identificador da cena que está sendo editada. As operações usam a atualização transacional existente; versões da organização protegem edições concorrentes de nomes, notas e sessões.

Limites: até 60 cenas e 40 sessões, com notas de até 2000 caracteres por cena/sessão. Campanhas que utilizam a coleção têm limite de 8 MB de estado estruturado; arquivos de mapas continuam separados desse estado. O mapa é um único fundo por cena; esta entrega não adiciona vários fundos arrastáveis na mesma cena, personagens em cenas públicas diferentes ou iluminação por paredes.

## Verificação

Testes cobrem preservação da campanha antiga; isolamento entre cenas; arquivos privados; restauração de tokens, desenhos e combate; recursos globais de ficha; sessões e reordenação; cópias de mapa e limpeza de arquivos; exclusões protegidas; versões concorrentes; rejeição de ações e prévias antigas; publicação via SSE; filtragem e renderização do organizador. O fluxo integrado cria sessão e cena, prepara privadamente, compartilha com jogadores e retorna ao cenário anterior.

A validação visual em navegador real e o teste TCP em aparelhos reais permanecem pendentes neste ambiente; a abertura de portas TCP locais é bloqueada pelo ambiente de execução.
