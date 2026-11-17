# Rolagens: animação, histórico e privacidade

Pesquisa e implementação em 11 de novembro de 2026.

## Referências

- [Roll20 — 3D Dice](https://help.roll20.net/hc/en-us/articles/360039715613-3D-Dice). Oferece apresentação visual de dados, ativação individual e visualização de rolagens de outros participantes. A Forja adota o controle individual e a apresentação dos resultados públicos recebidos.
- [Foundry — Dice So Nice](https://foundryvtt.com/packages/dice-so-nice) e [guia do projeto](https://riccisi.gitlab.io/foundryvtt-dice-so-nice/guide/getting-started/). Mostram a abordagem de dados animados na mesa. A Forja usa uma implementação própria leve para funcionar sem instalar bibliotecas gráficas ou consultar serviços externos.

## Apresentação

A implementação projeta sólidos tridimensionais em Canvas 2D, com geometria própria para d4, d6, d8, d10, d12 e d20. Cada face recebe iluminação e gradiente, e as sombras variam com a altura. O lançamento combina rotação por quaternion, trajetória balística com quiques amortecidos e desaceleração até a face final. Não há colisões entre dados. SVG com animação CSS permanece como alternativa quando Canvas não está disponível. Não exige WebGL, bibliotecas gráficas ou serviços externos. O resultado é recebido do servidor, e a animação termina nos valores recebidos. O total nunca é calculado por um segundo sorteio no navegador. A numeração dos dados convencionais é fixa por face: o sólido é orientado para mostrar a face sorteada. Os números são projetados no plano de cada face, com perspectiva e recorte, sem mudança de orientação ao revelar o resultado. O painel fica centralizado na tela; dentro dele, as faces finais formam um grupo centralizado, sem deslocamento aleatório na chegada.

Cada dado mostra o tipo e a face final. Ao parar, a face sorteada ganha contorno dourado e número maior; os números vizinhos recuam suavemente em tamanho e contraste. A legenda explicita, por exemplo, “d20 = 17”, separando o valor natural do total com modificadores. O d100 é representado por dois d10, de dezenas e unidades (00 + 0 representa 100). Tipos não convencionais usam uma forma poliédrica ilustrativa com o valor correto, sem prometer geometria específica para cada quantidade de faces. O efeito dura cerca de 2 a 2,6 segundos; movimento reduzido revela imediatamente. A resolução é limitada a duas vezes a resolução CSS para controlar o custo em celulares. Em vantagem e desvantagem, o dado descartado fica esmaecido e riscado. Resultados iguais são tratados corretamente: somente a quantidade de dados efetivamente aproveitada é destacada. Dados subtraídos conservam a indicação de sinal. Tipos personalizados continuam funcionando com a identificação de faces.

A apresentação limita o número de dados desenhados a 16 em telas maiores e 6 em telas pequenas ou baixas. Todos os dados permanecem nos detalhes do histórico; a animação informa quantos ficaram além do limite visual. Uma fila limitada a oito rolagens evita uma sequência longa de efeitos durante rajadas. A primeira carga de uma campanha não reproduz o histórico antigo, e cada identificador é animado apenas uma vez.

A camada visual não toma o foco nem bloqueia os controles da mesa. É possível fechar o resultado. O botão Animar dados guarda a preferência no navegador. Movimento reduzido mostra o resultado sem giro, e a aba em segundo plano não acumula animações para reproduzir ao voltar.

## Histórico e sincronização

O histórico ocupa a coluna do mapa, imediatamente abaixo da cena. O painel lateral mantém os controles da ficha. Os registros mostram autor, total, expressão, detalhes dos dados e indicação de privacidade. A sincronização de rolagens atualiza apenas o histórico, preservando zoom, navegação e campos em edição. Detalhes expandidos e a posição do histórico são preservados ao receber novos registros.

No servidor Linux, as rolagens também chegam pelo canal contínuo autenticado em todas as abas da campanha, inclusive fichas, livros e áudio. A consulta compartilhada de 400 ms permanece como recuperação e alternativa quando o canal não está disponível. Um identificador de versão do histórico visível evita repetir a lista quando ela não mudou. Essa sincronização permite que as animações públicas sejam exibidas aos participantes conectados, mas não garante início no mesmo milissegundo em dispositivos com latências diferentes.

## Privacidade

O servidor marca a origem da rolagem a partir do acesso autenticado. O cliente não pode escolher sua origem ou publicar uma rolagem do mestre enviando campos no pedido. Toda rolagem de mestre é privada, inclusive as feitas em uma ficha e as disparadas por conjuração. Rolagens de jogador são públicas para a mesa, respeitando também os filtros de personagens ocultos.

As respostas de campanha, ações e sincronização excluem resultados privados para jogadores. A versão pública não muda por causa de uma rolagem privada. O navegador também descarta resultados privados de um contexto de jogador e limpa sua camada visual ao mudar de campanha, de papel ou quando uma rolagem deixa de estar disponível.

Registros antigos não têm uma origem autenticada armazenada. Para não inferir incorretamente pelo nome do ator, esses registros ficam restritos ao mestre. Os dados antigos são preservados, mas não são expostos aos jogadores. Há uma retenção independente de até 40 resultados públicos e 40 privados, para que rolagens secretas não substituam o histórico público.

## Verificação

Testes cobrem deduplicação, resultado revelado, redução de movimento, desativação, fila, retirada de acesso, mudança de papel, vantagem com valores iguais, tipos personalizados, limite visual, localização e atualização do histórico sem alterar o mapa. Os testes de API verificam todas as respostas, falsificação de origem, legado, retenção pública, retirada de personagem oculto e conjurações privadas do mestre.

## Extremos naturais

Quando há exatamente um d20 positivo aproveitado, o 20 natural recebe uma indicação verde e o 1 natural uma vermelha. Um único pulso suave no painel acompanha a revelação. A indicação textual permanece, inclusive sem animação em movimento reduzido. Dados descartados em vantagem/desvantagem, modificadores e totais não disparam o efeito. Múltiplos d20 somados e outros tipos de dados não recebem classificação automática. A indicação mostra mínimo/máximo natural e não determina sucesso, falha ou dano: a aplicação de críticos depende do sistema e do tipo de teste.

## Cores e popup compartilhado

O editor de personagem e o criador D&D oferecem 24 cores. O padrão de destaque da ficha usa essa escolha; uma cor hexadecimal própria salva em **Organizar → Cores e estilo** tem prioridade. Se a ficha salva ainda usava a cor padrão anterior, trocar a cor do personagem também acompanha esse destaque, com incremento da versão de aparência para proteger edições concorrentes.

Cada nova rolagem armazena `diceColor` a partir da ficha autorizada no servidor; enviar esse campo na requisição não permite forjar a cor. Todos os participantes recebem o mesmo resultado, cor e ID usado como semente da animação, sem acesso à aparência completa das fichas alheias. Dados de tipos diferentes na mesma rolagem compartilham o material escolhido. Dados 3D e a versão SVG de compatibilidade seguem a mesma cor. Alterar a ficha depois não repinta uma rolagem já registrada.

Rolagens públicas abrem o popup em qualquer tela da campanha, respeitando a preferência local **Animar dados** e redução de movimento. Rolagens de iniciativa salvas (incluindo o botão D&D) permanecem no histórico, mas o popup aparece somente para o autor: o jogador vinculado à ficha que rolou, ou o mestre quando a rolagem privada foi dele. As do mestre continuam privadas. Ao abrir uma campanha, o histórico anterior não é reproduzido como novas animações.

Testes verificam o mesmo popup para dois jogadores e mestre, popup de iniciativa restrito ao autor, cor personalizada, paleta ampliada, descarte de cor forjada, consistência entre tipos de dados, eventos SSE filtrados e recebimento enquanto a ficha está aberta. Inspeção visual em navegador real e sincronização de tempo em aparelhos físicos não foram realizadas neste ambiente.
