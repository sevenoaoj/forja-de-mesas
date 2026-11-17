# D&D 2024 — SRD 5.2.1

Consulta em 11 de novembro de 2026. A página oficial identifica o SRD 5.2.1 como sua publicação atual para as regras revisadas de 2024, também identificadas pela Wizards como 5.5e.

- Página oficial e versão: https://www.dndbeyond.com/srd
- PDF oficial completo, 364 páginas: https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf
- Licença: https://creativecommons.org/licenses/by/4.0/legalcode

## Atribuição exigida

This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

Os resumos em português e a organização do catálogo foram adaptados para a Forja. Não constituem tradução oficial. A integração usa o conteúdo aberto do SRD, com referências ao PDF completo. Os livros comerciais completos não são redistribuídos pelo aplicativo.

## Decisões de experiência

A criação segue as dependências descritas no capítulo Character Creation: primeiro identidade, classe e origem, depois atributos e seus bônus, proficiências e revisão. A sugestão de atributos vem da tabela Standard Array by Class, na página 21. O jogador pode redistribuir os valores ou usar valores definidos com o mestre. O servidor verifica a sequência, os bônus do antecedente e as escolhas de perícia.

A interface continua usando os painéis originais. Os atributos mostram pontuação e modificador separados. As referências de rolagem guardam o vínculo com o atributo e calculam o modificador no servidor. Proficiência, especialização, CD e ataque mágico acompanham o nível e os atributos atuais. Nas fichas D&D, referências aos seis atributos usam o modificador por padrão, inclusive na expressão livre `1d20 + Força`. A sintaxe explícita `@{dd-str|score}` permite usar a pontuação bruta quando necessário. Isso evita somar a pontuação inteira de Força a um teste de d20.

O compêndio local tem 53 consultas rápidas: as 12 classes, 9 espécies e 4 antecedentes do SRD, 13 magias iniciais, 7 armas e 8 referências de regras. A busca funciona sem internet. O filtro de magias considera a classe; opções de outras classes precisam de confirmação explícita de regra adicional. Adicionar uma referência cria uma habilidade e, quando aplicável, botões de ataque, dano ou cura. Os links abrem a seção correspondente do PDF, com o capítulo de magias iniciando na página 107.

## Automação implementada

- Criação guiada de personagens de nível 1, incluindo os dois modos de bônus de antecedente: +2/+1 ou +1/+1/+1.
- Salvaguardas proficientes da classe e as 18 perícias, com seleção das perícias iniciais e duas especializações para ladinos.
- PV iniciais, tenacidade de anão, deslocamento básico da espécie e CA inicial sem armadura, incluindo as fórmulas de bárbaro e monge.
- Proficiência de +2 a +6 conforme o nível; modificadores e valores mágicos recalculados em cada uso.
- Ataques e dano das armas da seleção, considerando acuidade, distância e treinamento básico da classe. Outras concessões de proficiência podem ser ajustadas nas rolagens.
- Vantagem/desvantagem com 2d20 e retenção do maior/menor resultado. Danos e curas não recebem vantagem automaticamente.
- Ataques, danos e curas da seleção de magias. Cura de Curar Ferimentos usa 2d8 + modificador; Palavra Curativa usa 2d4 + modificador, conforme as regras de 2024.
- Escalonamento dos dados de truques nos níveis 5, 11 e 17. Rajada Mística mantém dano por raio; os ataques adicionais são feitos separadamente.
- Conjuração explícita consome um espaço de 1º círculo quando necessário. Botões avulsos de ataque/dano não consomem outro espaço. Um último espaço não pode ser gasto por dois pedidos concorrentes.
- Descanso longo restaura PV e os recursos configurados. Descanso curto recupera espaços de Pacto, um uso de Fúria e um uso de Retomar o Fôlego. Dados de Vida e cura de descanso curto são controlados manualmente.

## Escopo e escolhas manuais

A criação guiada parte do nível 1. Evolução de classe, subclasses, multiclasse, aumentos de atributo por nível, novos limites de recursos e espaços de círculos superiores continuam manuais nas ferramentas universais da ficha. A mudança de nível recalcula proficiência e os modificadores derivados, mas não aplica automaticamente todas as características recebidas em níveis posteriores.

Escolhas adicionais de linhagem, ancestralidade, talentos humanos, ordens de clérigo/druida, estilo de luta, invocações, idiomas, equipamento inicial e magias são indicadas para revisão e registro. CA com armadura/escudo, efeitos de talentos, imunidades, concentrações, condições, inspiração, críticos, aplicação de dano e efeitos especiais de classe não são resolvidos automaticamente. Usos gratuitos de magia de talentos/origem são controlados manualmente. Essas regras estão acessíveis no livro completo.

O catálogo rápido é uma seleção; não representa todas as magias, armas ou características do SRD. Referências e rolagens adicionais podem ser criadas com os recursos universais já existentes.

## Livro completo

A biblioteca oferece o PDF oficial em inglês. O mestre pode salvar uma cópia por campanha usando o servidor, com limite de 40 MB, validação de assinatura PDF, timeout, controle de acesso, prevenção de duplicação e limpeza em caso de falha. Uma cópia salva usa o mesmo acesso compartilhado dos livros enviados e permite consultas pela rede local sem depender de internet depois do download.

O download real não pôde ser executado neste ambiente, que não resolve o domínio externo. O endereço foi verificado na página oficial e a operação foi testada com respostas controladas, incluindo sucesso, repetição, falta de permissão e resposta inválida. A importação pode ser repetida no PC do usuário ou substituída pelo envio do PDF na biblioteca.

## Campanhas

A página inicial abre a lista de campanhas, sem campanha demonstrativa ou criação implícita. A exclusão exige a chave de criador e confirmação do nome atual, faz comparação de revisão no banco e remove os arquivos do diretório/prefixo da campanha. Participantes só removem o atalho do navegador. A exclusão de uma mesa não apaga arquivos de outras campanhas.

## Validação

Testes exercitam as 12 classes, atributos e bônus inválidos, proficiências, cálculo dinâmico, curas revisadas, retenção de d20, espaços e concorrência, descanso, importação do livro, exclusão com SQLite real e o fluxo da interface desde a criação de campanha até um ataque com vantagem. O fluxo usa uma simulação do DOM; não substitui uma conferência visual em um navegador real.
