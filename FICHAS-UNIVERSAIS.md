# Fichas universais

Pesquisa e implementação em 11 de novembro de 2026.

## Referências

- [RoleSmith — Universal TTRPG Builder](https://rolesmith.app/). A documentação pública apresenta atributos personalizados, rastreadores de recursos e botões com expressões próprias. A Forja adota atalhos explícitos para adicionar atributos e recursos e uma lista de rolagens nomeadas.
- [Roll20 — Macros & Token Actions](https://help.roll20.net/hc/en-us/articles/360037256794-Macros-Token-Actions). As macros e ações de personagem usam valores da ficha em comandos reutilizáveis. A Forja vincula rolagens a campos e consulta o valor vigente no servidor a cada uso.
- [Let's Role](https://lets-role.com/). O produto apresenta um construtor de sistemas e atalhos para rolagens da ficha. A Forja concentra o uso durante a sessão em botões salvos no painel Dados.

## Estrutura e edição

A ficha continua usando os campos compartilhados da campanha até o usuário salvar uma estrutura própria. O editor começa com todos os campos efetivos, incluindo os antigos campos locais. Ele permite adicionar, remover, renomear e reordenar atributos e recursos já herdados do modelo. O agrupamento usa o nome da seção.

A primeira personalização salva uma cópia independente da estrutura no personagem. Assim, um jogador pode ter dois atributos e outro seis, sem alterar a campanha ou as outras fichas. Campos existentes conservam seus identificadores e valores. Novos campos usam seu valor inicial. A remoção efetiva de um campo também remove seu valor. O editor limita cada ficha a 100 campos. A edição do modelo continua disponível ao mestre.

Os recursos usam pares atual/máximo e podem existir em qualquer quantidade dentro do limite de campos. Cada recurso tem barra, botões de incremento/decremento e edição direta de valores entre zero e o máximo, até 1000000. O comportamento anterior de Vitalidade continua válido.

## Rolagens

Cada ficha pode salvar até 60 botões com nome e expressão. A interface aceita nomes, como `2d6 + Força`, e referências explícitas, como `2d6 + @{Força}`. O seletor ajuda a inserir campos e a prévia mostra o cálculo numérico sem sortear resultados.

O servidor converte os nomes em vínculos por identificador. Uma renomeação preserva o vínculo. A mudança de valor aparece na próxima rolagem. Nomes ambíguos exigem escolher uma referência específica pelo seletor. Campos removidos ou valores inválidos produzem erro em vez de resultados incorretos.

O interpretador aceita apenas dados, somas, subtrações e referências reconhecidas. Não executa código. A mesma validação é usada na prévia e no servidor. As rolagens ficam limitadas a 240 caracteres, 50 dados de 2 a 1000 faces e referências a inteiros entre -9999 e 9999. Referências a contadores usam o valor atual. Multiplicação, funções, comparação de sucessos e dados Fate não fazem parte desta alteração.

Os resultados guardam o nome da rolagem, a expressão resolvida e os valores consultados, permitindo conferir o cálculo no histórico. O servidor usa exclusivamente a fórmula salva quando um botão é acionado.

## Permissões e compatibilidade

As mudanças usam as permissões de edição da ficha já existentes. Um jogador personaliza e rola apenas pelo próprio personagem. Resumos de outras fichas não incluem os campos ou botões salvos. O mestre mantém acesso completo, e fichas ocultas continuam filtradas.

Fichas antigas, campos locais, recursos existentes e expressões numéricas anteriores continuam funcionando. Testes verificam remoção de atributos herdados, vários recursos independentes, estrutura vazia, vínculo após renomeação, valores negativos, limites de dados, histórico, permissões e o fluxo da interface.
