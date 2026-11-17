# Escuridão e visão direcional

## Referências e decisões

O [Foundry — Tokens](https://foundryvtt.com/article/tokens/) documenta configuração de visão por token, alcance/ângulo, rotação e composição da visão dos tokens controlados pelo usuário. Também distingue o controle de movimento da permissão de editar configurações de visão. O [Roll20 — Your Vision Gains Direction](https://bloghub.roll20.net/posts/three-updates-for-updated-dynamic-lighting/) descreve o centro da direção e a abertura do campo como parâmetros separados. A Forja adota esses princípios, adaptando os controles ao mouse e ao celular e mantendo sua névoa livre existente.

Esta implementação calcula alcance e cones. Não replica os motores completos de iluminação desses produtos: não inclui paredes/portas, fontes de luz, penumbra por iluminação ou rastreamento de exploração automática.

## Como usar

1. O mestre abre a cena e usa o botão de lua para ativar/desativar a escuridão. **Configurar mesa** permite escolher visão individual ou compartilhada pelo grupo.
2. Em **Editar token → Campo de visão**, configure se o token enxerga, alcance e abertura. O alcance usa a unidade da cena. 120° é um cone; 360° é visão circular. 0° aponta para o norte, 90° para leste, 180° para sul e 270° para oeste.
3. Ao selecionar um token, arraste sua seta para girar a direção. Escape cancela. Também há controles de direção abaixo do mapa, teclas Q/E e Shift + roda do mouse, em passos de 15°. O controle deslizante permite ajustes de 1° e funciona por toque.
4. O mestre pode usar **Ver pela visão deste token** para observar o recorte opaco. Fora da prévia, o mestre conserva uma camada translúcida para preparar a cena sem perder o mapa inteiro.

A escuridão começa desativada nas campanhas antigas. A visão padrão de cada token é habilitada com alcance de 9 unidades e abertura de 120°. Tokens mantêm a orientação ao mover; o usuário decide a direção. A imagem e os ícones giram junto com o campo de visão; rótulos e condições permanecem na posição de leitura, com uma seta indicando a orientação. Somente o mestre define alcance e abertura. O jogador pode girar apenas tokens vinculados à sua ficha e desbloqueados.

## Composição e sincronização

Na visão individual, todos os tokens do personagem controlado contribuem para seu recorte; selecionar outro token não concede sua visão. No modo de grupo, o servidor identifica como fontes os tokens de personagens controlados por jogadores, excluindo tokens e personagens ocultos. PNJs independentes e fichas sem dono não compartilham visão com o grupo por acidente. Cada token conserva sua própria configuração, inclusive para prévia do mestre.

O campo usa distância euclidiana em coordenadas contínuas, dividida pela escala da grade; não é recortado em quadrados. A borda do alcance recebe uma suavização para dentro do raio. Fontes sobrepostas se somam, sem que a borda de uma volte a escurecer o centro da outra. A própria base do token continua identificável para permitir seu controle mesmo sem alcance de visão.

A camada de escuridão cobre mapa, grade, desenhos e tokens. A névoa manual vem depois e continua bloqueando áreas que o mestre não revelou. Girar ou mover o token não apaga a névoa. Tokens fora da visão também saem da lista visual e do foco de teclado do jogador. O mestre continua recebendo e controlando todos os tokens.

A posição segue os mesmos snapshots e prévias de movimento da mesa. O recorte acompanha o arraste local e as prévias remotas, sem esperar o polling. A rotação possui uma ação específica, `tokenRotate`: o cliente mostra a prévia durante o ajuste e salva ao concluir o gesto; a orientação final é transmitida aos demais participantes. O botão do meio mantém a navegação em todas as ferramentas. Cancelamentos, bloqueios e mudança de cena descartam prévias locais.

As configurações ficam em `state.table.darkness` e `token.vision`/`token.rotation`. Como pertencem ao estado da cena, seguem a duplicação, troca de sessões e o backup portátil. O botão de escuridão preserva as áreas e o histórico da névoa manual.

## Limites e verificação

A escuridão controla a apresentação na mesa. Assim como a névoa atual, não é uma proteção contra inspeção técnica: o mapa original e as posições dos tokens não ocultados continuam sincronizados. A ocultação explícita pelo mestre continua retirando o token dos dados públicos. Paredes desenhadas em imagens não geram geometria de bloqueio; use a névoa manual para interiores e áreas privadas.

`tests/vision.test.mjs` cobre alcance, ângulos, escala, retorno em 360°, visão circular, fontes compartilhadas, máscara, permissões, integridade de configurações, SSE e isolamento por cena. `tests/table-ui.test.mjs` cobre botões, teclas, Shift + roda, slider, arraste da seta, Escape, movimento contínuo local/remoto e lista sem tokens fora da visão. A suíte existente verifica que câmera, névoa, tokens, fichas e demais ferramentas continuam funcionando.

A tentativa de captura em Firefox headless nesta instalação falhou na inicialização do navegador, antes de renderizar a página. A validação inclui geometria/API, DOM simulado e a renderização SVG descrita abaixo; não representa teste visual em um celular real.

## Refinamento visual e de rotação

A máscara anterior herdava `stroke: currentColor; stroke-width: 1.6` da regra genérica de ícones `.vtt svg`. Como o mapa usa coordenadas em células, esse contorno tinha espessura de 1,6 células: formava a borda clara do mapa e cobria o trecho estreito do cone junto ao token. O centro geométrico já estava correto; o defeito era o contorno herdado. A camada agora isola explicitamente o traço no SVG, na máscara e em suas formas, sem deslocar a origem nem alterar o alcance do personagem.

A correção foi reproduzida e conferida em uma renderização SVG usando librsvg: a amostra na borda passou de RGB (230,226,233) para (9,11,20), e a amostra logo à frente do token passou de (19,22,26) para a cor do mapa (139,156,105). Essa verificação cobre a máscara e a cascata CSS reproduzida; não substitui uma sessão real no navegador.

A orientação agora atualiza transforms de grupos e caminhos SVG existentes, conservando os gradientes e a máscara, em vez de recriar todo o SVG em cada evento. Eventos de ponteiro são agrupados pelo quadro de renderização. Retrato, indicador frontal e cone usam o mesmo ângulo. Botões e snapshots remotos recebem uma transição curta pelo caminho angular mais próximo (359° → 1° percorre 2°, não 358°). Arraste e slider acompanham diretamente o controle. A preferência de redução de movimento desativa a interpolação.

Comandos rápidos de giro acumulam a direção desejada localmente e mantêm no máximo uma requisição em voo e um destino pendente. Assim, uma resposta lenta não descarta entradas de roda ou teclado nem cria uma fila de orientações ultrapassadas. Shift + Ctrl + roda permite ajuste de 1°; Shift + roda mantém 15°.

As decisões seguem a distinção entre orientação e rotação da arte documentada em [Foundry — Tokens](https://foundryvtt.com/article/tokens/) e os controles de rotação descritos no [Roll20 — Token Features](https://wiki.roll20.net/Token_Features), adaptadas à máscara e ao transporte já existentes na Forja. Não inferem a arquitetura interna dessas plataformas.

## Cones do mestre e visão compartilhada

Com a escuridão ativa, o mestre vê por padrão o contorno do campo de visão de todos os tokens que possuem alcance habilitado, incluindo PNJs e tokens ocultos. As guias usam a cor do token; a seleção recebe destaque, e tokens ocultos têm traço pontilhado. A camada de guias fica acima da névoa para permitir a preparação. O botão **Cones** permite recolher essas guias somente no navegador do mestre. Jogadores nunca recebem essa camada; a prévia de jogador também a oculta.

Na barra da mesa, o mestre pode alternar **Visão: individual** e **Visão: compartilhada**. O controle salva a mesma configuração de **Configurar mesa → Quem compartilha a visão**, por cena. No modo compartilhado, cada jogador enxerga a união dos campos dos personagens controlados na cena. O mestre pode voltar à visão individual a qualquer momento. Tokens ocultos, fichas ocultas e PNJs sem controle de jogador não liberam visão para o grupo. A movimentação dos tokens e o acesso às fichas mantêm suas próprias permissões.

A prévia compartilhada do mestre usa as mesmas fontes dos jogadores, sem conceder a visão de um PNJ apenas porque ele foi selecionado. As posições e rotações das guias são atualizadas nos próprios grupos SVG, preservando a fluidez anterior. Os testes verificam a ausência das guias no jogador, cones de inimigos ocultos restritos ao mestre, mudança e revogação de compartilhamento para dois jogadores, configuração no SSE e controle da interface.

A rotação pelo arraste da seta ou pelo controle de direção envia o ângulo pelo mesmo canal ao vivo das posições, sem gravar a cada quadro. Os outros clientes atualizam o retrato e o recorte de visão juntos. Ao soltar, a direção é persistida e a prévia encerrada após o snapshot confirmado; quadros atrasados do gesto não sobrescrevem o resultado. Escape, desconexão e expiração restauram a direção canônica. Onde SSE não está disponível, a direção final continua chegando pela sincronização periódica.

## Fichas de jogador e NPCs

O mestre define **Tipo de ficha** ao criar uma ficha universal ou D&D, ou usa **Tipo: Jogador / Tipo: NPC** na barra da ficha aberta. As listas de fichas e o vínculo dos tokens identificam os dois tipos. Fichas antigas sem classificação são tratadas como personagens jogadores; classifique os NPCs existentes explicitamente. Não é feita uma migração destrutiva dos dados.

Em **Visão: compartilhada**, cada token visível vinculado a uma ficha de personagem jogador fornece seu campo de visão a todos os jogadores da mesa, mesmo que pertença a outra ficha ou que essa ficha ainda não tenha um usuário responsável. NPCs, fichas ocultas, tokens ocultos, itens e tokens independentes não fornecem visão ao grupo. O modo individual continua limitado à ficha do próprio jogador. A névoa manual continua respeitada.

Somente o mestre altera o tipo. NPCs não aparecem como fichas disponíveis no convite; converter uma ficha já vinculada em NPC libera o vínculo do jogador e revoga seu controle. A visibilidade da ficha é uma configuração separada: classificar como NPC não a oculta automaticamente. O backup preserva a classificação, e a visão compartilhada continua funcionando após restaurar o backup, mesmo antes de os jogadores refazerem seus vínculos.
