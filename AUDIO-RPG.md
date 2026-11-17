# Áudio para sessões de RPG

Pesquisa realizada em 11 de novembro de 2026, com documentação oficial de Foundry VTT, Roll20, Syrinscape, Kenku FM e YouTube. As decisões abaixo atendem ao fluxo solicitado para a Forja de Mesas. O mestre prepara seu repertório e escolhe manualmente qual faixa toca. O repertório começa vazio, sem seleção automática de músicas.

| Prática | Utilidade durante a sessão | Decisão recomendada para a Forja |
| --- | --- | --- |
| Preparar repertório antes de jogar | Reduz a procura por links enquanto o grupo espera. | Sessões nomeadas pelo mestre, com faixas adicionadas por ele a partir de links do YouTube. |
| Organizar por clima ou cena | Ajuda a encontrar rapidamente uma trilha de exploração, tensão, descanso ou combate. | Grupos e etiquetas livres, com busca por título. Os nomes e a organização pertencem ao mestre. |
| Escolher a faixa em um clique | Permite responder ao ritmo imprevisível da narrativa. | Um botão de tocar por faixa, com indicação da faixa atual. Troca manual. |
| Distinguir preparação de reprodução | Evita que adicionar ou editar uma faixa interrompa o que todos estão ouvindo. | Salvar faixas altera o repertório. O comando explícito de tocar inicia a transição compartilhada. |
| Mostrar o que está tocando | Dá contexto aos jogadores e torna pausas e carregamentos compreensíveis. | Área persistente com faixa atual, estado e ativação do som. Repertório futuro visível apenas ao mestre. |
| Suavizar início e encerramento | Evita mudanças bruscas de volume que atrapalham a conversa. | Fade-in e fade-out configuráveis, com opção de duração zero. A implementação usa 3 segundos como padrão ajustável pelo mestre, de 0 a 30 segundos. |
| Separar volume da mesa e volume individual | O mestre equilibra a trilha, e cada participante adapta sua escuta. | Volume compartilhado da faixa combinado com o volume local e com o envelope do fade. |
| Preservar efeitos rápidos | Mantém portas, impactos e alertas disponíveis durante a música. | Soundboard separado do repertório, com comandos exclusivos do mestre e volume de efeitos local. |
| Exibir estado real do player | Evita interpretar espera de rede como ausência de comando. | Estados de carregando, tocando, pausado e erro, com recuperação explícita. |
| Encerrar sem escolher a próxima | Mantém a intenção narrativa nas mãos do mestre. | Sem repetição, encerrar; com repetição ativada pelo mestre, repetir somente a faixa atual. A lista organizada não dispara a próxima faixa automaticamente. |

O Foundry reúne pastas, descrições, modos de reprodução, volumes e duração de fade por lista e faixa. Também distingue ajustes que afetam todos os participantes dos controles locais e oferece pré-carregamento de arquivos. Para a Forja, preparação, identificação clara da faixa atual e controles simples oferecem uma base adequada ao repertório escolhido durante a narrativa. [Foundry — Playlists](https://foundryvtt.com/article/playlists/)

O Roll20 oferece etiquetas e busca na biblioteca. Seu widget de reprodução mostra aos jogadores as faixas ativas, preservando a lista de preparação do mestre. Essa separação ajuda a evitar que títulos e agrupamentos futuros revelem uma cena ainda não apresentada. [Roll20 — Jukebox](https://help.roll20.net/hc/en-us/articles/360039178714-Jukebox)

O Syrinscape organiza combinações sonoras em Moods e Scenes. Esses recursos apoiam mudanças rápidas de ambiente e ajustes de elementos, como música, criaturas e clima. A Forja pode aproveitar a organização por contexto e a preparação antecipada, mantendo a seleção de músicas com o mestre. [Syrinscape — suporte e personalização](https://syrinscape.com/faq/)

O Kenku FM documenta operações separadas para listas e soundboards, incluindo estado de reprodução, volume e repetição. Nos efeitos, a API descreve fade-in e fade-out. A divisão entre trilha contínua e efeitos pontuais evita que o repertório e os sons rápidos disputem os mesmos controles. [Kenku FM — Remote](https://www.kenku.fm/docs/using-kenku-remote)

A API oficial do YouTube permite carregar ou preparar vídeos, tocar, pausar, consultar posição e ajustar volume entre 0 e 100. Seus eventos distinguem player pronto, carregamento e bloqueio de reprodução automática. Essas interfaces permitem implementar uma rampa de volume com o player existente. A documentação não oferece uma operação de crossfade. [YouTube — IFrame Player API](https://developers.google.com/youtube/iframe_api_reference)

A estratégia recomendada para o YouTube usa a sequência fade-out da faixa atual, troca no mesmo player e fade-in da faixa escolhida. O documento de funcionalidade mínima inclui o início programático pela API na regra que limita a um player YouTube tocando automaticamente por página. Ele também exige visibilidade adequada do player e preservação dos elementos do vídeo. Um crossfade que sobreponha automaticamente dois players YouTube entraria em conflito com essa regra. [YouTube — Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality)

A integração deve conservar o vídeo e o fluxo de reprodução oficial. As políticas restringem extração ou separação do áudio, reprodução por player oculto e interferência nos anúncios. O fade deve usar os controles documentados durante as transições pedidas pelo mestre. A pesquisa não encontrou uma autorização específica para detectar ou suprimir anúncios por meio de fades. [YouTube — Developer Policies](https://developers.google.com/youtube/terms/developer-policies)

Para implementar a experiência compartilhada, o repertório precisa de IDs persistentes de sessões e faixas. O estado de reprodução precisa registrar a faixa escolhida, posição, volume, comando e horários da transição no relógio do servidor. Apenas o mestre altera esses dados. Cada cliente aplica o envelope de volume a partir desse estado, junto com sua preferência local. Quem entra depois consulta a posição atual e começa por ela.

Uma nova ordem durante um fade deve substituir a transição anterior de forma consistente, preservando o volume calculado para aquele instante. Pausar e encerrar precisam definir quando o áudio chega ao silêncio e quando a posição é preservada ou reiniciada. Sem repetição, o fim de uma faixa atualiza o estado da mesa uma única vez, sem iniciar outra música. Com repetição, os participantes permanecem no ciclo da faixa escolhida pelo mestre.

Carregamento do YouTube, anúncios, políticas do navegador e diferenças de rede podem produzir pausas distintas entre aparelhos. A experiência deve mostrar essa espera e corrigir a posição ao retornar à reprodução. A transição sequencial suaviza os níveis de volume, e sua duração real inclui o tempo necessário para o próximo vídeo começar. A reprodução ao vivo entre PC e celular precisa ser verificada além dos testes com players simulados.

Casos prioritários de validação são trocar de faixa durante um fade, pausar e retomar, receber comandos concorrentes, entrar atrasado, retornar após perder conexão, falhar ao carregar um vídeo e manter a reprodução quando a interface é atualizada. Os testes também devem conferir o bloqueio dos comandos de mestre para jogadores e a privacidade do repertório futuro.

## Repetição e controles recolhidos

A opção **Repetir esta música ao terminar** fica no cadastro/edição da faixa. O mestre também pode usar **Repetir: ativado/desativado** na faixa atual, tanto na aba Áudio quanto na playlist retrátil. Alterar a repetição da faixa atual também atualiza sua preferência no repertório, se ela ainda estiver lá. Editar uma faixa no repertório prepara a opção para a próxima reprodução; não altera sozinha a trilha ativa.

A duração informada pela API do YouTube é compartilhada pelo mestre e vinculada ao identificador do comando atual. A posição de uma música em repetição usa o relógio da mesa módulo a duração: quem entra depois chega ao ciclo atual, e os clientes retomam a reprodução ao receber o evento de término. Com a duração disponível, o ciclo não depende de uma mensagem de fim da aba do mestre. Pausar conserva a posição dentro do ciclo; desativar a repetição após várias voltas conserva o ponto atual e o nível de fade. Metadados e eventos de um vídeo anterior não devem substituir a música escolhida em seguida. Se a duração ainda não foi obtida, há um reinício compartilhado de contingência ao receber o fim na aba do mestre.

A repetição foi feita para músicas gravadas, com duração definida. A documentação do YouTube informa que `getDuration()` retorna zero antes dos metadados e representa tempo de transmissão em vídeos ao vivo; repetir lives não tem a mesma semântica. Há limites de sincronização e buffering: não se promete um loop sem qualquer pausa entre ciclos. [API do YouTube — duração e estados do player](https://developers.google.com/youtube/iframe_api_reference)

Os controles locais agora ficam num botão circular de 46 px em todas as telas. Ao abrir: ativar/silenciar o som da aba, volume da música, volume dos efeitos, acesso à aba Áudio e, apenas para o mestre, playlist e controles compartilhados. Fechar pelo botão, pelo X, com Escape ou ao clicar fora não altera a reprodução. A abertura é preservada durante sincronizações e navegação e é recolhida ao mudar de campanha ou papel. Não guarda títulos da playlist para jogadores. O player YouTube permanece na aba Áudio.

Os testes simulam mestre/jogadores repetindo no mesmo ciclo, pausa, desativação após várias voltas, duração atrasada, conflito entre comandos, permissões, configuração salva por faixa e abertura/fechamento/acessibilidade do painel. A reprodução real entre PC e celular ainda exige a validação com rede e players YouTube reais.

## Retomada fora da aba Áudio

Ao aplicar uma ordem de retomar depois de uma pausa, o cliente usa `loadVideoById` com o mesmo vídeo e a posição compartilhada atual, preservando a instância do player. Isso evita depender da sequência de busca seguida de play em um embed pausado fora da tela, que pode ficar em carregamento. A mudança só acontece quando o comando de retomada entra em vigor no relógio compartilhado; mantém o fade e não recarrega o vídeo em cada sincronização. Mestre e jogadores usam o mesmo fluxo.

Um teste de regressão simula o embed pausado e fora da tela que fica em buffering após uma busca: o fluxo anterior falha e o corrigido retoma no ponto certo sem abrir a aba Áudio nem recriar o iframe. A validação com YouTube real em PC e celular permanece necessária para confirmar o comportamento de cada navegador.
