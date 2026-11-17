# Ficha modular e duas formas de leitura

Pesquisa e implementação: 12 de novembro de 2026.

## Referências e decisões

| Referência | Inspiração | Aplicação na Forja |
| --- | --- | --- |
| [Sheet Tailor, catálogo oficial do Foundry](https://foundryvtt.com/packages/freeform-sheets) | Blocos móveis, redimensionamento, ocultação visual e manutenção dos dados/rolagens do sistema. | Retrato, identidade, campos, perícias, habilidades e dados são módulos, todos vinculados à mesma ficha. |
| [Role — Drag & Drop Builder](https://www.playrole.com/) | Composição de fichas para diferentes sistemas sem programar. | Organização visual por jogador sem precisar escrever CSS ou HTML. |
| [Custom System Builder, catálogo oficial do Foundry](https://foundryvtt.com/packages/custom-system-builder) | Estrutura de ficha e fórmulas independentes da apresentação. | Aparência separada dos campos, valores e fórmulas existentes. |
| [Hyprland — Dwindle Layout](https://wiki.hypr.land/0.56.0/Configuring/Layouts/Dwindle-Layout/) | Organização em uma árvore de divisões, com espaços proporcionais em vez de janelas sobrepostas. | Mosaico binário: soltar nas bordas divide o espaço, soltar no centro troca os módulos, e divisórias ajustam as proporções. |

É uma implementação própria de mosaico; não executa Hyprland dentro do navegador. O editor prioriza encaixe e proporção, sem coordenadas absolutas nem sobreposição de campos.

## Como usar

Na ficha, escolha **Personalizada** ou **Padronizada**. A primeira mostra o visual salvo do personagem; a segunda usa os painéis originais de leitura e mostra todos os campos, inclusive os ocultos no visual personalizado. O mestre começa na visão padronizada por padrão. A preferência de leitura é guardada no navegador separadamente para mestre e jogador. Alternar a leitura não salva nem altera a aparência do personagem.

**Organizar** abre um rascunho de aparência. O modo **Simples** usa grade automática, larguras prontas e reordenação por arraste ou ↑/↓. O modo **Mosaico avançado** mantém as divisões descritas abaixo:

- Arraste pela alça ⠿ do cabeçalho. Nas bordas de outro módulo, surge uma indicação da metade onde ele será encaixado. No centro, os dois trocam de posição.
- Arraste uma divisória para ajustar os espaços. Com foco nela, use setas para ajustes de 5%, Home para 20% e End para 80%. O botão ⇄ alterna a orientação daquela divisão.
- O retrato é independente da identidade e pode ir a qualquer parte do mosaico. Cada campo da ficha também é um módulo individual.
- Módulos podem ser ocultados, reativados, recolhidos e receber títulos visuais próprios. Isso não renomeia nem apaga os campos usados nas fórmulas.
- Escolha cor de destaque, quatro fundos, três tipografias, densidade, formato do retrato, espaçamento, cantos e altura do mosaico no desktop.
- Os modelos Três colunas, Retrato lateral e Coluna única reorganizam os módulos visíveis. A organização pode ser ajustada depois.
- O formulário Mover sem arrastar oferece os mesmos encaixes para teclado e toque.
- Desfazer guarda até 30 operações durante a edição. **Salvar aparência** persiste a composição na campanha; **Descartar** recarrega os dados atuais e abandona o rascunho. Fechar a aba perde alterações não salvas.

A organização é salva por personagem e acompanha quem tem acesso detalhado à ficha, inclusive o mestre quando escolhe Personalizada. O mestre pode editar a aparência como já pode editar a ficha. Não há um segundo conjunto de valores: recursos, perícias, habilidades, rolagens e retrato continuam usando os mesmos dados e permissões.

No celular, a árvore é linearizada em uma coluna, sem altura fixa, preservando a ordem dos módulos. As divisórias de proporção ficam indisponíveis nessa apresentação; arraste por alça e o formulário de movimento continuam disponíveis. Cabeçalhos e controles têm alvos maiores de toque. No desktop, o modo avançado permite altura entre 600 e 4000 px, com rolagem interna dos módulos. No modo simples, os blocos têm altura natural.

## Compatibilidade e limites

Fichas existentes não precisam de migração. As que ainda não têm aparência salva continuam na visão padronizada até o usuário optar pela personalizada. A aparência inicial usa os campos atuais, sem campanha, personagem ou dados de exemplo novos. Novos campos aparecem automaticamente e módulos de campos removidos são reconciliados. Campos ocultos continuam nas rolagens e na visão padronizada.

O limite segue os 100 campos de cada ficha, mais os módulos funcionais. A árvore aceita até 24 níveis e divisões entre 20% e 80%. Cores, fundos e fontes são opções validadas: esta versão não oferece CSS/HTML arbitrário, imagem própria de fundo, importação/exportação de modelos ou janelas flutuantes sobrepostas.

Perícias executam seu teste pelo servidor e não dependem de o módulo de dados estar visível. Rolagens salvas e livres confirmam a elegibilidade da maestria e do modo d20 antes do envio. As fórmulas dos truques continuam acompanhando o nível por meio das funções compartilhadas com a mesa.

## Privacidade e persistência

A ação `sheetAppearance` exige acesso à própria ficha ou papel de mestre. A estrutura completa não é enviada nos resumos dos outros jogadores nem no convite. Personagens ocultos continuam inacessíveis aos jogadores. Ocultar visualmente um campo não é uma regra de acesso: dados da própria ficha continuam disponíveis em Padronizada.

O servidor valida IDs de módulos, duplicatas, profundidade, proporções e opções visuais. A aparência tem uma versão independente: duas edições concorrentes geram um conflito claro em vez de sobrescrever silenciosamente. Recursos e aparência podem ser salvos simultaneamente sem perder alterações, usando a revisão transacional da campanha.

## Verificação

Testes cobrem conservação de módulos ao mover/trocar, proporções, cancelamento de gesto, ponteiro, teclado, ocultação/restauração, títulos e escape, modelos, validação, campos alterados durante a edição, desfazer, edição concorrente, permissão por ficha, dados preservados e recursos simultâneos. O fluxo do aplicativo testa o jogador salvando e ocultando módulos, uma perícia sem o módulo de dados, o mestre abrindo Padronizada e consultando Personalizada sem mudar a versão salva.

A inspeção visual real em navegador/celular não foi possível neste ambiente. Os testes de interface usam DOM e eventos simulados; a validação final de conforto em telas reais permanece necessária.

## Editor simplificado e responsivo

O padrão agora é **Simples · ajuste automático**: a árvore existente define a ordem, e os blocos se distribuem em uma grade com altura natural. É possível escolher uma, duas ou três colunas no computador; em áreas menores a grade reduz as colunas e, no celular, usa uma coluna. Não é necessário configurar altura, proporção ou direção de divisões para organizar a ficha.

- Arraste pela alça para a região desejada, inclusive espaços vazios. Uma prévia animada reposiciona os vizinhos antes de soltar. Escape ou soltar fora da grade cancela; Desfazer reverte o gesto inteiro.
- Durante a edição, ↑ e ↓ movem o bloco uma posição e funcionam com toque ou teclado.
- O botão ⋯ abre as opções daquele bloco: título, largura Normal/Largo/Linha inteira, recolher e ocultar.
- **Cores e estilo** reúne os ajustes visuais; medidas e densidade ficam em **Mais ajustes**. Alterar cor, título, largura e colunas não remonta os controles, preservando a edição em andamento.
- **Mostrar ou ocultar blocos** inclui busca sem acentos. A busca e a posição da lista são preservadas ao ocultar/reativar campos.
- Os botões de salvar, cancelar e desfazer ficam acessíveis no topo; no celular são repetidos ao final da ficha, sem sobrepor o conteúdo.
- **Editar dados** trata de valores e campos; **Organizar** trata da disposição visual. O botão Organizar fica desabilitado durante a organização, evitando reiniciar um rascunho por acidente.

A aparência anterior continua armazenada e pode ser consultada escolhendo **Mosaico avançado · divisórias**. Alternar os modos sem reordenar mantém a árvore salva; reorganizar no modo simples atualiza essa ordem explicitamente. Não há migração destrutiva nem alterações de valores ou fórmulas. A visão padronizada do mestre permanece independente.

Testes adicionais verificam o modo simples padrão, conservação de árvores antigas, reordenação antes/depois, setas com limites, confirmação do arraste somente ao soltar, edição visual sem remontagem e validação das larguras/colunas no servidor. A inspeção visual em navegador real continua pendente neste ambiente.

## Encaixe reativo e cores de destaque

A grade simples agora usa empacotamento de retângulos com alturas naturais. Cada bloco ocupa a primeira região livre que comporta sua largura; um bloco baixo pode ocupar o espaço abaixo de outro baixo, mesmo ao lado de Habilidades com conteúdo longo. Um bloco largo ainda precisa de espaço contíguo suficiente. A disposição visual pode anteceder um módulo anterior da ordem salva ao preencher lacunas; em uma coluna, a ordem salva é linear.

Referências adicionais: [Muuri — layout.fillGaps](https://docs.muuri.dev/grid-options.html) inspira o preenchimento dos espaços disponíveis; [dnd-kit — sortable](https://dndkit.com/concepts/sortable/) inspira a prévia otimista durante o gesto. A implementação usa JavaScript nativo, ResizeObserver e animação FLIP com Web Animations, sem incluir essas bibliotecas. Mudanças de altura, recolhimento, imagens e largura de tela recalculam o encaixe.

O arraste usa a área inteira da grade como destino, sem depender de acertar outro bloco. Os vizinhos se movem por 200 ms, a origem fica marcada e uma etiqueta acompanha o ponteiro. A rolagem da página acompanha a proximidade das bordas. A ordem entra no rascunho somente ao soltar em um destino válido; salvar continua sendo explícito. A preferência `prefers-reduced-motion` desativa o movimento interpolado. As setas de reordenação permanecem disponíveis para teclado e toque.

As duas leituras usam a mesma paleta por personagem: atributos em azul, recursos em verde, perícias em índigo, habilidades em âmbar, dados em violeta e história em rosa. **Cores e estilo → Cores por seção** permite trocar cada destaque. O botão ⋯ permite uma cor própria para cada bloco personalizado ou restaurar a cor da seção. Bordas, títulos e fundos recebem o destaque; nomes e valores continuam expressos em texto.

Testes cobrem o espaço sob blocos curtos ao lado de um bloco alto, ausência de sobreposição com até 108 blocos e larguras diferentes, destino em área vazia, prévia animada anterior à confirmação, cancelamento, desfazer, uma/duas/três colunas, altura dinâmica e movimento reduzido. A API valida e persiste as cores por seção e bloco. Não houve inspeção visual em navegador real neste ambiente.
