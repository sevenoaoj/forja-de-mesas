# Mesa virtual

A mesa da Forja de Mesas reúne ferramentas para campanhas de sistemas diferentes. A pesquisa consultou a documentação oficial de Foundry VTT, Roll20 e Owlbear Rodeo em 10 de novembro de 2026. A seleção abaixo considera a utilidade durante a sessão e o modelo atual do aplicativo, com servidor local, fichas universais e convite da campanha.

| Recurso | Utilidade durante a sessão | Decisão para este incremento |
| --- | --- | --- |
| Pan e zoom | Navegar por mapas grandes e consultar detalhes. | Integrar a navegação e controles para aproximar, afastar e ajustar à tela. A posição da câmera é local a cada navegador. |
| Grade configurável | Adaptar a mesa às dimensões do mapa e à escala do sistema. | Permitir ajustar linhas, colunas, unidade, visibilidade e encaixe. As campanhas existentes começam com a grade de 16 × 10. |
| Régua | Conferir movimento e alcance de ações. | Integrar a medição entre pontos com resultado na escala definida para a mesa. |
| Ping | Apontar uma porta, inimigo ou posição durante a conversa. | Mostrar um marcador temporário compartilhado, acessível aos participantes. |
| Desenhos geométricos | Representar zonas de perigo, efeitos e planos táticos. | Integrar formas sobre o mapa, com cor e remoção. |
| Névoa manual | Revelar visualmente a exploração ao longo da sessão. | Integrar ocultação e revelação pelo mestre. A imagem original do mapa continua sendo enviada ao navegador. |
| Tamanho e condição dos tokens | Distinguir criaturas grandes e registrar estados relevantes ao sistema. | Integrar tamanho em células e condição curta definida pelo grupo. |
| Tokens ocultos e bloqueados | Preparar encontros e evitar movimentos acidentais. | Reservar o controle ao mestre. Os dados de tokens ocultos devem ser filtrados nas respostas aos jogadores. |
| Token ligado à ficha | Consultar o personagem e reaproveitar sua identificação. | Integrar vínculo opcional entre token e personagem. |
| Iniciativa pública | Acompanhar a ordem de combate diretamente na mesa. | Mostrar o combate ao grupo e oferecer controles de turno ao mestre. |
| Múltiplas cenas | Preparar locais e encontros separados. | Integrado: cenas agrupadas em sessões, preparação privada do mestre e ativação para jogadores, com mapa, tokens e exploração próprios. |
| Iluminação dinâmica e paredes | Calcular visibilidade a partir do ambiente e da posição de cada personagem. | Evolução posterior, pois exige um modelo de cena e visão mais amplo. |
| Dono individual de token | Permitir que cada jogador mova apenas seus personagens. | Integrado por identificação individual no navegador e vínculo com a ficha escolhida. |

## Referências consultadas

O Owlbear Rodeo apresenta configuração de grade, encaixe e escala, além de régua para distância e movimento. Essas ferramentas ajudam a usar o mesmo espaço de jogo em sistemas com escalas diferentes. [Cenas](https://docs.owlbear.rodeo/docs/scenes/), [Medição](https://docs.owlbear.rodeo/docs/measure/)

O Roll20 reúne pan, zoom, ping e apontador para navegação e comunicação no mapa. O ping compartilhado permite indicar rapidamente um local da cena. [Visão geral da mesa](https://help.roll20.net/hc/en-us/articles/360039734913-Tabletop-Overview)

O Foundry documenta controles de tamanho, aparência, condições e combate associados a tokens. O vínculo com a ficha e a presença de estados no mapa reduzem a alternância entre ferramentas durante o encontro. [Tokens](https://foundryvtt.com/article/tokens/)

As ferramentas geométricas do Owlbear servem a mapas improvisados, táticas e áreas de efeito. A névoa manual permite preparar e revelar áreas ao longo da exploração. [Desenho](https://docs.owlbear.rodeo/docs/drawing/), [Névoa](https://docs.owlbear.rodeo/docs/fog/)

As cenas e camadas do Foundry incluem visão, exploração, iluminação e paredes. A adaptação desses recursos depende de infraestrutura adicional no modelo da Forja. [Cenas](https://foundryvtt.com/article/scenes/), [Camadas](https://github.com/foundryvtt/foundryvtt/blob/master/articles/canvas-layers.html)

## Limites da exploração e dos convites

A névoa manual cobre a imagem na interface para acompanhar a exploração. O navegador recebe a imagem original do mapa e pode acessá-la enquanto o participante estiver autorizado à campanha. O sigilo efetivo das partes ainda desconhecidas depende de recortes ou tiles calculados e entregues pelo servidor. A ocultação de tokens deve ser aplicada pelo servidor, incluindo as verificações de acesso e de movimentação.

O convite permite que cada navegador registre uma identificação individual de jogador. O participante escolhe uma ficha disponível ou cria a sua. A API restringe os detalhes da ficha e os movimentos de tokens ao jogador responsável, e o mestre pode liberar esse vínculo. Fichas ocultas ficam fora das listas e respostas aos jogadores. O Owlbear documenta permissões por camada e controles específicos de dono. [Permissões](https://docs.owlbear.rodeo/docs/permissions/)

Cenas e sessões agora estão integradas. Fluxo de preparação, referências e limites: [CENAS-E-SESSOES.md](CENAS-E-SESSOES.md).
