# Escudo do mestre

Pesquisa e implementação: 11 de novembro de 2026.

## Referências e decisões

| Referência | O que ajuda durante a sessão | Aplicação na Forja |
| --- | --- | --- |
| [GM Screen, catálogo do Foundry](https://foundryvtt.com/packages/gm-screen) | Painéis modulares com diários, atores, regras e tabelas acessíveis rapidamente. | Cartões organizáveis, fixados, recolhíveis e largos; referências vinculadas e tabelas sorteáveis. |
| [Journal, documentação oficial do Roll20](https://help.roll20.net/hc/en-us/articles/360039675133-Journal) | Repositório de fichas e materiais, com acesso privado ou compartilhado. | Separação de dados no servidor, referências para fichas e consulta sem copiar seus valores. |
| [GM Vault, diretório do Owlbear Rodeo](https://extensions.owlbear.rodeo/gm-vault) | Preparação organizada por assunto, PDFs e links abertos rapidamente, privados por padrão. | Categorias Sessão, Regras e Personagens e mundo; busca sem acentos; links para a página de um livro, ficha ou entrada do SRD. |

A síntese é uma decisão de produto da Forja, não uma reprodução desses sistemas. Os controles para reordenar substituem arrastar e soltar, para funcionarem com teclado e toque. Não são necessários serviços de notas externos, credenciais adicionais ou bibliotecas novas. Nenhuma aventura ou tabela de resultados é adicionada automaticamente: o mestre escreve seu próprio conteúdo.

## Organização

- Cartões de anotações, tarefas, tabelas e referências. Até 80 cartões por campanha, com título, categoria e até 6000 caracteres de conteúdo.
- Fixar coloca um cartão antes dos demais; setas reordenam dentro do grupo de fixados ou não fixados, respeitando a busca/categoria atual. Recolher e largura são persistidos na campanha.
- Tarefas podem ser marcadas na tela. Na edição, `[x]` conserva uma tarefa concluída e `[ ]` conserva uma tarefa pendente.
- Tabelas aceitam de 2 a 100 entradas. Cada resultado começa com peso 1. Um peso 3 dá ao resultado o triplo da chance de uma entrada de peso 1. Para cadastrar vários resultados de uma vez, cole uma lista com um por linha no campo **Resultado**.
- Marque **Sortear sem repetição até reiniciar** para retirar cada entrada sorteada das próximas rodadas. O cartão mostra quantas restam. **Reiniciar sorteios** devolve todas à tabela. Os sorteios anteriores continuam no histórico privado do mestre.
- Referências podem abrir uma ficha, regra resumida do SRD ou página de um PDF já importado. Referências removidas aparecem como indisponíveis e podem ser corrigidas editando o cartão. Navegar para páginas depende do suporte do visualizador de PDF do navegador.
- O resumo das fichas usa os campos reais de cada personagem. Todos os recursos têm valor atual/máximo e ajuste de um ponto. O mestre pode escolher até oito campos numéricos para cada resumo. D&D prioriza CA, PV temporários, proficiência, CD, deslocamento e nível quando disponíveis; demais números ficam nos detalhes. Rolagens salvas da ficha podem ser disparadas em segredo.
- Combate usa `state.table.combat`, exatamente como a mesa virtual: nenhuma rodada paralela é criada. A iniciativa antiga continua disponível para importar pelo editor existente.
- O bloco de notas anterior é preservado. Rascunhos ficam em memória por campanha enquanto a aba estiver aberta e sobrevivem à navegação, mas só o botão Salvar envia o texto ao servidor. Fechar/recarregar a aba descarta rascunhos não salvos.
- O layout se adapta a telas estreitas, mantendo controles por toque. A playlist retrátil e volumes existentes continuam disponíveis.

## Privacidade e consistência

`gmScreen` é excluído das respostas para jogadores e convidados, incluindo preferências de resumo e resultados de tabelas. Todas as ações são autorizadas no servidor. Rolagens de tabelas e de fichas feitas pelo mestre são privadas, seguem a retenção independente e não mudam a versão pública de rolagens.

O combate continua compartilhado como na mesa, preservando as regras existentes para tokens ocultos. Um cartão de referência privado **não torna privado o material de destino**: os PDFs da biblioteca continuam compartilhados com os participantes. O editor informa essa distinção.

Cartões usam versão de conteúdo: uma edição ou remoção desatualizada recebe erro em vez de sobrescrever mudanças de outra aba. Marcar uma tarefa também invalida uma edição antiga. Fixar, recolher e reordenar não substituem o conteúdo. A persistência usa a mesma transação com revisão da campanha já utilizada no restante do sistema.

## Verificação

Os testes cobrem criação/edição/remoção, ordenação e fixação, tarefas, edições concorrentes, referências válidas/removidas, limites, busca e escape de texto, ausência de dados privados nas respostas, autorização de todas as ações, sorteios no servidor, resumo de atributos, integração da rodada e fluxo do aplicativo (criar cartão, marcar tarefa, navegar com rascunho e salvar notas). A tentativa de prévia com Firefox headless falhou no ambiente de execução; não foi possível fazer uma inspeção visual real em navegador nesta sessão.
