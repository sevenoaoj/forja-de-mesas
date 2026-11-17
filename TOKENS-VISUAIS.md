# Cores e símbolos de tokens

A aparência de tokens agora usa uma paleta de 24 amostras com seleção visível e uma galeria de 30 símbolos vetoriais, além de **Automático** e **Inicial**. A prévia combina cor, nome e símbolo antes de salvar. Os controles são grupos de rádio nativos, com nomes acessíveis, indicação de seleção e navegação por teclado. A galeria tem rolagem própria e quatro colunas em telas estreitas.

**Automático** usa primeiro o retrato importado no token, depois o retrato da ficha vinculada ou a inicial. O mestre pode importar PNG, JPEG, WebP ou GIF de até 3 MB ao criar ou editar um token, inclusive independente, com prévia antes de salvar. Para trocar a imagem, importe outro arquivo; para removê-la, marque **Remover retrato importado**. Os retratos acompanham cenas duplicadas e backups `.forja`, respeitam a ocultação dos tokens e são removidos do armazenamento quando a última referência é apagada. **Inicial** força a letra mesmo quando há retrato. Um símbolo escolhido substitui o retrato. Ícones no mapa acompanham o tamanho do token e também aparecem na lista lateral. A sincronização incremental troca símbolo, retrato e cor sem remontar a cena. Fichas, permissões e regras de movimentação permanecem vinculadas ao mesmo token.

O servidor valida o identificador em uma lista fechada. Não aceita URLs, HTML ou SVG fornecidos pelo cliente. Os tokens antigos recebem `auto` sem migração destrutiva; símbolos inválidos em dados antigos voltam ao automático. Os ícones são locais, funcionam sem CDN ou conta externa e não exigem instalar bibliotecas no servidor do mestre.

Ao selecionar um token vinculado a uma ficha controlada por jogador, o mestre encontra **Mensagem privada** junto a **Editar token**. O editor de mensagem abre com esse personagem como destinatário. A entrega usa as permissões e a confirmação de leitura das mensagens privadas existentes. Tokens independentes ou ligados a fichas sem jogador não oferecem esse botão.

## Referências e origem dos vetores

- [Foundry — Tokens](https://foundryvtt.com/article/tokens/): configuração de aparência e imagens dos tokens.
- [Owlbear — Assets](https://docs.owlbear.rodeo/docs/managing-assets/): organização de personagens e imagens em categorias visuais.
- [Illandril’s Token Tooltips para Foundry](https://github.com/illandril/FoundryVTT-token-tooltips): o projeto documenta o uso dos ícones Font Awesome disponibilizados pelo Foundry.
- [Font Awesome 4 — licença oficial](https://fontawesome.com/v4/license/): a fonte é distribuída sob SIL OFL 1.1.

Os 30 símbolos foram extraídos de glifos do Font Awesome 4.7 já disponíveis localmente, convertidos de coordenadas de fonte para caminhos SVG e selecionados para papéis, criaturas, objetos e lugares. O projeto inclui atribuição, descrição da conversão e licença completa em `public/FONT-AWESOME-LICENSE.txt`, acessível pelo link da galeria e incluída no executável Linux.

Testes verificam as amostras, opções acessíveis, prévia, retrato versus símbolo, persistência no servidor, bloqueio de edição por jogadores, rejeição de símbolos externos e criação/edição pela interface. Não houve inspeção visual em navegador real neste ambiente.
