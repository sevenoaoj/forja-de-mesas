# Dados da ficha na mesa virtual

Pesquisa e implementação: 11 de novembro de 2026.

## Referências

- [Roll20 — ficha D&D 2024](https://blog.roll20.net/posts/game-changing-features-on-roll20s-2024-dd-character-sheets/): organização de ações e modificadores para reduzir a procura e erros durante o jogo. Aplicação: ações de um clique com fórmulas visíveis e opções de vantagem separadas.
- [Foundry D&D5e — Enrichers](https://github.com/foundryvtt/dnd5e/wiki/Enrichers): comandos específicos para testes, salvaguardas, ataques e danos, vinculados aos dados do personagem. Aplicação: testes de atributos e perícias enviados por identificador; o servidor lê a ficha atual e monta a expressão.
- [Nimble Foundry — Character Sheet](https://nimble-co.github.io/FoundryVTT-Nimble/documentation/characters/character-sheet.html): recursos, identidade e rolagens têm funções distintas; clicar numa habilidade/perícia dispara o teste correspondente. Aplicação: categorias Testes, Ações, Recursos e Livre, sem usar um clique em atributo como alteração silenciosa da expressão anterior.

## Problemas corrigidos

| Antes | Agora |
| --- | --- |
| Cada clique em atributo anexava outra referência ao texto, podendo repetir ou acumular bônus sem ficar claro. | Cada clique rola um teste completo e independente do atributo escolhido. |
| Todas as perícias usavam 1d20. | Herdeiros usa 2d6; D&D usa 1d20; fichas universais podem ajustar os dados-base dos testes rápidos. |
| Todos os campos numéricos eram mostrados como atributos de teste. | D&D apresenta somente os seis atributos. Nível, deslocamento, CA, PV temporários e outros números ficam nas informações da aba Recursos. |
| Um atributo de D&D mostrava sua pontuação, mas inseria o modificador. | O modificador usado no teste recebe destaque; a pontuação aparece como informação secundária. |
| Perícias eram convertidas em fórmulas pelo navegador antes do pedido. | O servidor resolve atributo, bônus, proficiência e especialização no estado atual da ficha. |
| A seleção de maestria podia acompanhar uma rolagem incompatível e causar erro. | O painel só a envia quando a fórmula usa o atributo vinculado e há um uso disponível; o servidor confirma e consome atomicamente. |
| A prévia de um truque podia usar a fórmula antiga salva, mesmo quando o servidor calculava mais dados pelo nível. | Prévia e execução compartilham a função que obtém a fórmula atual do truque. |

## Uso

**Testes:** clique em atributo, salvaguarda ou perícia. Cada opção mostra os dados e bônus que usará. A busca aceita nomes sem acentos. Perícias favoritas vêm primeiro. Em fichas universais, Dados-base pode ser ajustado, por exemplo, para `2d6`; isso altera os testes rápidos e perícias nessa seleção, sem editar os botões salvos da ficha. D&D mantém 1d20. A seleção local é reiniciada ao trocar de personagem ou campanha; configure uma rolagem salva para fórmulas permanentes.

**Ações:** ataques, dano, iniciativa e rolagens salvas. As fórmulas originais dos botões personalizados são respeitadas. Nas magias, Conjurar indica o gasto de espaço e fica indisponível quando não há espaços no recurso padrão. Dados das magias permite rolar ataque/efeito separadamente sem gastar outro espaço, para continuar uma conjuração já feita. Magias continuam usando os limites da integração SRD existente, descritos em DND-SRD.md.

**Recursos:** controles atual/máximo, além de valores numéricos informativos. Ajustar um recurso não dispara dados. Valores como nível e PV temporários podem ser editados pelo atalho da ficha.

**Livre:** expressão independente dos testes rápidos, com prévia numérica antes de rolar. Um seletor explícito permite inserir referências a atributos e a outros valores numéricos/recursos quando a regra personalizada precisar deles. É aqui que referências múltiplas e repetições são uma escolha explícita do jogador.

Nas fichas universais, os atributos rápidos são campos numéricos nos grupos Atributos/Attributes/Características/Capacidades ou vinculados a uma perícia. Campos em outros grupos continuam disponíveis na ficha e na expressão livre. Vantagem/desvantagem só é enviada quando a expressão resolvida começa com um único d20; dano de d6/d10 e testes de 2d6 mantêm seus dados. O painel não deduz resultados de sucesso/falha pela fórmula.

O personagem selecionado fica identificado. Jogadores só podem rolar pela própria ficha; o mestre pode selecionar fichas e tokens vinculados. Rolagens do mestre continuam privadas. Histórico, zoom e posição do mapa são preservados.

## Verificação

Testes cobrem separação de campos, pontuação/modificador D&D, bônus negativos, proficiência, especialização, Herdeiros, base personalizada, maestria, vantagem/desvantagem, fórmula adulterada enviada pelo cliente, uso dos valores atuais, acesso a outra ficha, atualização dos truques por nível, referências livres, buscas e mudança de categorias sem perder a expressão. Os testes de interface confirmam que cliques sucessivos não acumulam atributos e que o mapa mantém seu zoom. A validação visual real em navegador/celular não foi possível neste ambiente; os testes de interface usam DOM simulado.
