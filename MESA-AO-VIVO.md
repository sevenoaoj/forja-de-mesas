# Mesa ao vivo: pesquisa e decisões

Pesquisa em 12 de novembro de 2026. Escopo: servidor Linux local da Forja, mesa compartilhada no navegador, fichas e permissões existentes. As referências abaixo descrevem interações públicas; a arquitetura interna dos produtos não foi presumida.

## Referências avaliadas

| Referência oficial | Utilidade observada | Aplicação escolhida para a Forja |
| --- | --- | --- |
| [Foundry: Pings](https://foundryvtt.com/article/pings/) | Marcadores visíveis ao grupo e identidade por cor ajudam a apontar rapidamente um local. O mestre também pode mover câmeras. | Ping breve com um único pulso e nome adjacente. Não deslocar a câmera dos jogadores a cada ping. |
| [Roll20: Tabletop Overview](https://help.roll20.net/hc/en-us/articles/360039734913-Tabletop-Overview) | Distingue o ping de anéis e o Pointer, que mostra nome/cor e desaparece quando fica inativo. | Combinar a brevidade do ping com a identificação textual, sem criar um marcador persistente. |
| [Owlbear Rodeo: Fog](https://docs.owlbear.rodeo/docs/fog/) | Prévia do jogador e transparência do mestre evitam confundir preparação e apresentação. Formas e pincéis ajudam a preparar salas. | Preservar esses controles e melhorar a cobertura com textura e transição visual conservadora na borda das áreas reveladas. |
| [Owlbear Rodeo: Drawing](https://docs.owlbear.rodeo/docs/drawing/) | Diferencia curvas livres, formas livres e geometria; desenhos são úteis para mapas improvisados e planos táticos. | Desenho livre como primeira opção, mantendo linha, retângulo e círculo. |
| [Foundry: Drawing Tools](https://foundryvtt.com/article/drawings/) | O desenho livre acompanha o ponteiro e sua simplificação reduz os vértices necessários. | Amostrar o traço com distância mínima entre pontos e limitar o tamanho do comando, preservando sua extremidade. |
| [Foundry: Measurement](https://foundryvtt.com/article/measurement/) | O movimento pode exibir a rota e a distância antes da confirmação, e Escape cancela a operação. | Separar prévia transitória de posição confirmada; cancelar não deve gravar uma posição intermediária. Rota com múltiplos pontos fica fora deste incremento. |
| [Owlbear Rodeo: Permissions](https://docs.owlbear.rodeo/docs/permissions/) | Permissões por ferramenta e dono ajudam a delimitar a colaboração. | O movimento transitório deve respeitar as mesmas permissões do movimento definitivo e a ocultação explícita definida pelo mestre. |

## Sincronização: decisão de engenharia

O movimento local deve reagir imediatamente ao ponteiro. Os outros navegadores recebem uma prévia transitória por token durante o arraste, em vez de aguardar a soltura e o próximo ciclo de consulta da campanha. A posição final continua sendo validada e salva pelo servidor. Cada arraste é identificado; mensagens antigas não devem sobrescrever um gesto novo.

A escolha para o servidor local é um fluxo SSE autenticado, recebido por `fetch`, com comandos de prévia por POST. Isso reutiliza HTTP e as credenciais atuais. É uma decisão deste projeto, não uma afirmação sobre como Foundry, Owlbear ou Roll20 transportam suas mensagens. A [documentação de SSE da MDN](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events) descreve o fluxo UTF-8, os separadores, os comentários de manutenção e a reconexão. O cliente próprio precisa implementar a reconexão porque usa `fetch` para manter a autorização no cabeçalho.

A apresentação precisa atualizar tokens e camadas sem remontar a mesa inteira. Recriar o DOM durante uma ação de outro jogador destruiria o gesto local, o foco, a régua ou a câmera. Consultas completas continuam úteis para recuperar o estado confirmado depois de desconexões. Nenhuma rede oferece atraso zero; a sensação de continuidade depende de frequência moderada, atualização local imediata e ausência de bloqueio global durante movimentos de outros participantes.

## Comportamento e privacidade a preservar

- Prévia não é uma gravação da campanha a cada quadro. Soltar confirma; Escape, cancelamento do ponteiro ou expiração encerram o gesto transitório.
- Dois tokens de participantes diferentes devem se mover independentemente. Um estado global de “ocupado” não deve bloquear o recebimento remoto.
- O servidor decide quem pode mover cada token. O cliente não pode promover sua própria permissão enviando identificadores de personagem.
- A visibilidade deve ser calculada também na posição transitória. Somente um token explicitamente oculto pelo mestre deixa de ter suas coordenadas transmitidas aos jogadores; a névoa não filtra os tokens. Ao desaparecer, a apresentação remota precisa ser removida sem revelar o destino escondido.
- O nome do ping deve vir da identidade autorizada no servidor. O texto é escapado antes de entrar no HTML. IDs já exibidos não reiniciam a animação em uma nova sincronização.
- A névoa continua opaca nas áreas desconhecidas. Suavizar o visual não deve tornar o mapa oculto parcialmente visível.
- A cobertura visual ainda não é recorte confidencial da imagem original: o arquivo do mapa é entregue aos navegadores autorizados, como já documentado em MAPA-E-NEVOA.md. Tokens secretos continuam filtrados pelo servidor.

## Desempenho e acessibilidade

Uma conexão de eventos por aba é suficiente. Em HTTP/1, muitas abas podem consumir o limite de conexões por origem descrito pela MDN; não criar um fluxo para cada token. Prévia deve agrupar posições e descartar quadros intermediários atrasados, sem formar uma fila crescente de requisições. A posição definitiva sempre prevalece sobre a prévia antiga.

A névoa deve preferir textura estática e poucos elementos SVG. Filtros grandes e animação contínua sobre mapas ampliados podem pesar no celular. Movimento de tokens e pulsos devem respeitar `prefers-reduced-motion`. Nome e texto acompanham a cor, evitando depender apenas dela para distinguir ações.

O clique esquerdo revela névoa e o direito encobre enquanto a ferramenta de névoa está ativa. A ação equivalente precisa continuar disponível por botão para toque e dispositivos sem botão direito. O menu contextual do navegador só deve ser interceptado na área e ferramenta pertinentes. Desenho usa captura de ponteiro; dois dedos continuam permitindo navegação pelo mapa.

## Recursos implementados nesta revisão

O cliente usa um fluxo de eventos autenticado quando a mesa está aberta. As prévias de movimento são agrupadas no cliente em intervalos de 40 ms, com somente um envio em andamento e reaproveitamento da posição mais recente. A cena confirmada e os movimentos transitórios têm caminhos separados. Na ausência do fluxo contínuo, a consulta de sincronização pode incluir a mesa como alternativa; isso recupera posições confirmadas, não reproduz cada ponto de um arraste.

A camada de névoa usa uma base opaca com gradiente, ruído procedural estático e uma faixa suavizada restrita ao interior já revelado. Ela conserva as áreas retangulares e os controles de opacidade/prévia existentes. Desenho livre é o padrão e aceita até 600 pontos por traço; ao atingir esse orçamento, a amostragem reduz os pontos anteriores para continuar acompanhando a ponta do gesto.

O ping fica visível por até 1.500 ms, com um único pulso de 950 ms e nome textual. A idade vem do relógio do servidor; eventos antigos são descartados e IDs vistos não reiniciam a animação na sincronização. As transições de movimento e o pulso respeitam a preferência de movimento reduzido. O indicador de conexão distingue o fluxo ao vivo, a reconexão e a alternativa por consultas.

## Fora deste incremento

Visão automática por paredes, iluminação dinâmica, múltiplas cenas, trajetos com custo de terreno e sincronização entre vários processos exigem modelos adicionais. Não são prometidos por uma melhoria visual da névoa ou por um fluxo de eventos local. Para hospedagem distribuída, o canal precisa de coordenação compartilhada entre instâncias; a implementação em memória do servidor Linux não substitui esse serviço.

## Verificação

A revisão de pesquisa executou os 10 testes de `table-realtime.test.mjs` e os 25 de `table-ui.test.mjs`, todos aprovados. Eles conferem dois participantes movendo tokens simultaneamente, ordenação de mensagens, cancelamento, reconexão, expiração de prévias, filtragem por dono e ocultação explícita, preservação do gesto local, ausência de repetição dos pings, traço livre e alternativas de controle. Regressões adicionais cobrem requisições com estado antigo, descarte de quadros depois da confirmação final, alteração de geometria e mensagens malformadas. A medição em rede local e a inspeção em celulares reais complementam esses testes; testes simulados não demonstram um limite fixo de latência nem substituem avaliação visual.

Teste HTTP com servidor em processo separado disponível em `tests/table-network.test.mjs`. Neste ambiente, abrir portas TCP locais retorna `EPERM`; esse teste é explicitamente pulado quando isso ocorre. Os testes de API, fluxos SSE com ReadableStream, dois jogadores simultâneos, transporte do cliente e interação da mesa continuam sendo executados. Isso não substitui a validação final de latência na rede e nos aparelhos da sessão.

## Otimização do canal e da pintura

As prévias de movimento e rotação são agrupadas por gesto, com no máximo uma requisição de prévia em voo e cadência de movimento de 50 ms (até 20 Hz). As confirmações e cancelamentos têm prioridade e não são substituídos por movimentos de outro token. A fila é limitada a 64 gestos. A direção/posição final continua validada e persistida pelo servidor.

A recepção agrupa prévias por token em cada quadro visual; snapshots são processados na ordem, antes de liberar a prévia confirmada. O servidor serializa cada prévia uma vez e reutiliza os bytes entre os destinatários autorizados. O navegador reutiliza o cálculo de visibilidade e a lista de tokens e evita reescrever atributos que não mudaram. Respostas completas sem nova revisão não reaplicam a mesa a cada consulta periódica.

Movimentos remotos usam interpolação curta, entre 40 e 100 ms conforme o intervalo recebido, com a mesma posição visual aplicada à imagem do token e à origem do cone. A preferência de movimento reduzido mantém atualizações diretas. Isso suaviza os intervalos entre pacotes sem prever posições além das recebidas. O fallback de polling permanece disponível quando o canal SSE não está acessível.

Validação: testes de rajadas de 100 eventos, cadência de envio, conexão lenta com confirmação de tokens diferentes, ordenação entre snapshot e cancelamento e interpolação da imagem/cone no mesmo quadro. Esses testes não representam uma medição de latência da conexão real do usuário.

Ao girar enquanto arrasta um token, posição e ângulo usam a mesma sequência de prévias. A confirmação de rotação encerra somente a prévia do próprio giro, sem aposentar um arraste que ainda está em andamento. A posição exibida do token sempre vem do mesmo estado visual que posiciona a origem do cone, inclusive após confirmações intermediárias ou movimentos rejeitados.
