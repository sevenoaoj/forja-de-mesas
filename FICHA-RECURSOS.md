# Cores e recursos da ficha

Abra uma ficha e escolha **Cores e recursos**. O botão **Destaque da ficha**, junto ao nome, abre o mesmo painel. A amostra colorida ao lado de cada recurso leva diretamente ao seletor daquela barra.

- **Destaque da ficha:** seletor de cor nativo, sem precisar escolher pelo nome da cor. A escolha se aplica aos elementos que herdam o destaque, incluindo retrato e dados. Cores próprias de seções e blocos continuam independentes.
- **Cor da barra:** cada recurso tem sua própria cor, tanto na leitura padronizada quanto na personalizada.
- **Alerta crítico:** pode ser ativado ou desativado por recurso. O limite inicial é 25% e pode ser alterado entre 0% e 100%. Abaixo ou exatamente nesse limite, aparece “Crítico”, com borda e pulsação vermelha suave. Limite de 0% alerta apenas quando o recurso acaba. Máximo zero não ativa alerta.
- **Salvar cores:** grava as escolhas na ficha, mantendo campos, valores, organização e permissões. Conflitos com outra edição de aparência são recusados para evitar sobrescrita. As mudanças integram o histórico da ficha e a aparência exportada em modelos e backups.

As barras animam em aproximadamente meio segundo ao perder ou recuperar recursos. A animação parte da posição que estava na tela, inclusive durante mudanças sucessivas e sincronizações, e não reinicia do zero ao recriar a ficha. A preferência do dispositivo por movimento reduzido remove a animação e mantém um indicador crítico estático.

## Referências pesquisadas

- [Foundry VTT — Bar Brawl](https://foundryvtt.com/packages/barbrawl): seletores de cores e configuração individual de barras. Inspiração para dar autonomia a cada recurso.
- [Roll20 — Token Features](https://wiki.roll20.net/Token_Features): representação de recursos por atual/máximo e configuração das barras.
- [Foundry VTT — Death Effects](https://foundryvtt.com/packages/death-effects): efeitos acionados quando um recurso chega a zero. A pulsação suave e o limite percentual configurável desta implementação são escolhas próprias da Forja.

## Validação

Seis testes novos cobrem validação das cores e limites, compatibilidade com fichas antigas, exclusão de campos, estado crítico, formulário e preservação de layout, animação, movimento reduzido, permissões, persistência e conflitos de versão.

A suíte completa passou com 348 testes. Também houve verificação real em Chromium: selecionar e salvar cores, recarregar a ficha, conferir animações intermediárias, ativar alerta crítico, usar movimento reduzido e abrir o painel em largura de 390 px sem rolagem horizontal. A execução usou campanhas e SQLite temporários.
