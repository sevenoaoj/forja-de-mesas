# Pesquisa de melhorias em mesas virtuais

Consulta a fontes oficiais realizada em novembro de 2026. Esta avaliação considera a versão atual da Forja, com fichas universais, D&D aberto, áudio sincronizado, dados animados, biblioteca de PDFs, escudo privado, tokens personalizáveis, névoa livre e cenas/sessões. Não recomenda repetir esses recursos.

## Priorização

| Prioridade | Lacuna observada na Forja | Referência de produto | Utilidade e recorte recomendado | Custo/risco |
| --- | --- | --- | --- | --- |
| 1 | Não há diário de campanha compartilhável: a biblioteca contém PDFs públicos e o escudo mantém notas privadas. | [Foundry — Journal Entries](https://foundryvtt.com/article/journal/), [Roll20 — Journal](https://help.roll20.net/hc/en-us/articles/360039675133-Journal). | Documentos de notas, pistas, PNJs e missões, privados por padrão, publicação explícita para o grupo, retirada de acesso e busca. Separar texto publicado de anotações do mestre. Permite consultar o que o grupo descobriu sem depender de mensagens externas. | Médio. Filtrar no servidor e no canal ao vivo; não basta esconder no CSS. Preferir texto com quebras de linha a HTML arbitrário nesta rodada. |
| 2 | Régua e desenhos existem, mas não há áreas táticas com tamanho definido na escala da cena. | [Foundry — Measurement and Templates](https://foundryvtt.com/article/measurement/), [Owlbear — Drawing](https://docs.owlbear.rodeo/docs/drawing/). | Círculo, cone, linha e retângulo dimensionados por unidade do mapa, com prévia antes de confirmar e limpeza por cena. Útil para alcance, explosões, sopros e zonas de perigo em qualquer sistema. | Médio. Persistência pertence à cena, sem inferir aplicação automática de dano. Deve respeitar mouse/toque e não interceptar botão do meio. |
| 3 | Condições de tokens são apenas textos; o combate acompanha rodada e turno, mas não duração. | [Foundry — Active Effects](https://foundryvtt.com/article/active-effects/). | Contadores opcionais em rodadas e lembretes de expiração, independentes de D&D; permitir condições permanentes. Rótulo, duração e remoção explícitos reduzem esquecimentos do mestre. | Médio a alto. Evitar aplicar bônus ou determinar regras automaticamente; voltar turno e editar iniciativa precisam de semântica estável para não consumir duração duas vezes. |
| 4 | Notas de cena existem, mas não há marcadores ancorados a pontos do mapa que abram informação. | [Foundry — Journal Entries](https://foundryvtt.com/article/journal/), [Owlbear — Text](https://docs.owlbear.rodeo/docs/text/). | Pinos de pontos de interesse ligados a documentos do diário, privados para preparação ou publicados para consulta. Ajuda a marcar portas, pistas, entradas e locais de uma cidade. | Médio. Exige diário/handouts e permissões primeiro; um pino não pode revelar um documento ainda privado. |
| 5 | Fazer backup atualmente depende de copiar manualmente o diretório de dados do servidor. | [Foundry — User Data Backup](https://foundryvtt.com/article/user-data-backup/). | Backup/exportação verificável da campanha, contendo dados e arquivos, com recuperação assistida e validação de estrutura. De alto valor em instalação local no PC. | Médio a alto. Dados de acesso e arquivos privados precisam ser tratados como conteúdo de mestre; importações devem evitar caminhos arbitrários, sobrescrita silenciosa e arquivos ausentes. |

A ordem é uma decisão de engenharia para a Forja, não um ranking declarado pelos produtos pesquisados.

## Evidência das referências

O Foundry documenta diários com páginas de texto, imagem, vídeo e PDF, organização e permissões. Não é necessário reproduzir todos esses tipos: a Forja já tem PDFs e áudio; documentos de texto publicados sob controle do mestre preenchem a lacuna principal.

O Help Center do Roll20, na página Journal datada de 20 de julho de 2026, descreve personagens e handouts privados ou compartilhados, acesso por jogador/grupo, organização em pastas, arquivamento e a ação de mostrar aos jogadores. A proposta para esta rodada prioriza publicação para o grupo e organização simples; compartilhamento individual pode ser acrescentado depois com identidade persistida dos participantes.

O Foundry distingue medição de distância, custo de movimento e templates de área. Essa distinção é útil: a Forja pode adicionar áreas geométricas sem prometer terreno difícil, colisão com paredes ou automação de magias. O Owlbear já documenta marcadores livres e formas; a Forja implementou parte dessas formas, portanto a melhoria nova precisa ser a dimensão na escala e o tratamento de área, e não simplesmente mais um desenho.

Os Active Effects do Foundry podem alterar características temporariamente. Para a Forja, uma implementação mais limitada e universal — lembretes/contadores, sem alterar atributos originais — evita dependência de regras de um único RPG.

Pinos de diários e texto no mapa complementam a preparação de cenas existente. São recomendados após os documentos, para que permissões e conteúdo tenham uma única fonte de verdade.

## O que não priorizar nesta rodada

- Iluminação dinâmica e paredes: exigem um motor de visão e uma política de entrega de mapa que ainda não existe.
- Automação completa de dano, armaduras, resistência e efeitos de D&D: grande risco de impor um sistema às fichas universais.
- Biblioteca proprietária copiada de regras/sistemas fechados: a Forja já utiliza o material aberto do SRD.
- Mais personalização de cores como principal melhoria: já existem 24 cores, símbolos e composição modular de fichas.
- Substituir SSE por outro protocolo como objetivo isolado: avaliar comportamento observado e testes primeiro; trocar o transporte não corrige por si só ordenação, autorização ou reconexão.

## Limites da pesquisa

As páginas citadas comprovam funcionalidades e padrões de interação dos produtos. Não comprovam a arquitetura interna nem um desempenho garantido na rede do usuário. A seleção precisa ser acompanhada por testes de autorização, sincronização, persistência por cena e integração da interface. Esta pesquisa não representa teste visual de navegador real.
