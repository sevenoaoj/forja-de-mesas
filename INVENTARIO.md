# Inventário e fichas de itens

Pesquisa consultada em 17/11/2026:

- [Foundry VTT — Items](https://foundryvtt.com/article/items/): documentos próprios para itens, com informações e estatísticas, preparados no diretório e associados aos personagens.
- [Foundry VTT — Tutorial do mestre](https://foundryvtt.com/article/tutorial-two/): entrega de itens do diretório à ficha de um personagem.
- [Roll20 — Compendium Integration](https://help.roll20.net/hc/en-us/articles/360043790493-Compendium-Integration): conteúdo de referência que preenche fichas e permite abrir informações relacionadas.

A implementação adapta esses padrões ao sistema universal da Forja, sem importar conteúdo protegido ou aplicar regras de um sistema específico.

## Uso

1. O mestre abre **Inventário → Preparar item**. O catálogo é privado e pode ser preparado antes da sessão, inclusive para fichas ainda ocultas ou sem jogador vinculado.
2. Cada item tem nome, retrato enviado pelo mestre (PNG, JPG, WebP ou GIF, até 3 MB), categoria, raridade, peso por unidade, valor/moeda, descrição, propriedades, segredos e vínculo opcional ao diário.
3. **Entregar** seleciona ficha e quantidade. A entrega cria uma cópia independente e mantém o original no catálogo. Edições posteriores do original não alteram as cópias.
4. O inventário aparece ao final da ficha nas visualizações padronizada e personalizada. A página Inventário permite buscar por nome/conteúdo e filtrar por ficha ou catálogo.
5. O portador abre o item para controlar quantidade, equipamento e anotações. Quantidade zero representa um item esgotado e exige desequipá-lo. O jogador pode descartar sua pilha. A exclusão pelo mestre remove o original do catálogo e todas as cópias vinculadas nos inventários, inclusive as transferidas entre aliados. Tokens de itens já preparados na mesa conservam sua ficha própria.
6. Um documento do diário pode ser vinculado ao item. Quando autorizado, seu conteúdo aparece na ficha do item e o diário oferece um botão para abrir os itens relacionados. A entrega não compartilha o documento automaticamente: suas permissões continuam sendo definidas no Diário.

Na categoria **Consumível**, o mestre define os usos por unidade. A barra mostra a soma dos usos disponíveis na pilha. Use **−** para consumir e **+** para restaurar. Em uma entrega parcial, os usos disponíveis acompanham primeiro as unidades entregues. Consumíveis antigos começam com um uso por unidade.

Somente o mestre prepara e edita os dados principais do catálogo. Jogadores recebem apenas itens das fichas visíveis que controlam. Catálogo, itens de terceiros, segredos e vínculos a documentos não autorizados são filtrados no servidor. Não há bônus de atributos automáticos ao equipar: propriedades e efeitos são informativos, pois a campanha pode usar qualquer sistema.

O inventário é salvo no estado da campanha e incluído nos backups `.forja`. Campanhas antigas começam sem itens, sem migração destrutiva. O limite é 1000 registros e 512 KB por campanha; retratos enviados ficam armazenados na campanha e são incorporados ao backup, inclusive quando usados por cópias ou itens em cenas privadas. Versões por item recusam edições concorrentes desatualizadas.

Validação: `node tests/inventory.test.mjs` e `node tests/campaign-backup.test.mjs`. O build inclui os novos módulos e estilos.

## Apresentação dos itens

Os cartões do inventário exibem retrato inteiro, nome em destaque, categoria, raridade e prévia da descrição. A ficha completa separa descrição, efeitos e dados de peso/valor. Na coleta, a recompensa aparece centralizada, com retrato maior, nome e descrição, brilho breve sem repetição e botão **Continuar aventura**. A preferência de movimento reduzido desativa os efeitos. Antes de coletar, a prévia mantém descrição e propriedades em segredo.

Referências visuais e de interação: [Unboxing the Mystery](https://foundryvtt.com/packages/unboxing-mystery), com revelações de itens e metadados; [Canvas Loot](https://foundryvtt.com/packages/canvas-loot), com identificação visual e coleta no mapa; e [D&D Beyond — inventário](https://www.dndbeyond.com/posts/1054-its-in-the-bag-how-to-use-containers-on-your), para consulta dos detalhes e organização de equipamentos. A Forja usa efeitos CSS breves e preserva os controles e permissões existentes.

No editor do item, **Cor dos destaques** abre um seletor de cor com prévia imediata. A cor personaliza nomes, molduras e brilhos dos cartões e da coleta. Itens antigos usam dourado; cópias entregues ou colocadas no mapa preservam a cor que tinham ao ser criadas.
