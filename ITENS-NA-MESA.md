# Itens interativos na mesa

A Forja integra as recompensas da cena ao catálogo e ao inventário já existentes. A implementação se inspira no [Item Piles do Foundry](https://foundryvtt.com/packages/item-piles), que transforma pilhas e recipientes em objetos interativos, e no [Loot! do Owlbear Rodeo](https://extensions.owlbear.rodeo/loot), que permite preparar recompensas por cena e revelá-las durante a sessão. A Forja usa cópias de itens e as permissões próprias de fichas, sem depender desses módulos ou de um sistema de regras específico.

## Fluxo do mestre

1. Prepare a ficha do item no catálogo de **Inventário**.
2. Use **Colocar na mesa** no item ou **Colocar item** no cabeçalho da mesa virtual.
3. Escolha quantidade e posição. O objeto começa oculto; marque **Revelar para os jogadores agora** caso deva aparecer imediatamente. O nome no mapa é opcional e pode diferir do nome real da ficha.
4. Arraste o token para ajustar a posição. Ao selecioná-lo, use **Revelar para jogadores** ou **Ocultar item**. O token usa o retrato do item quando o mestre enviou uma imagem; sem imagem, apresenta um ícone da categoria.

Cada colocação guarda uma cópia independente da ficha preparada. Editar ou apagar o catálogo depois não muda silenciosamente recompensas que já foram posicionadas. O original continua no catálogo para reutilização. Todos os atores e itens compartilham o limite de 100 tokens da cena. Para entregar diretamente a uma ficha, o mestre pode abrir o item no mapa e escolher **Entregar e retirar da mesa**, inclusive sem proximidade.

## Fluxo do jogador

Selecione o item e use **Coletar item**; também é possível abri-lo com duplo clique ou Enter. Aproxime um token do seu personagem: deve haver no máximo uma célula entre as bordas dos tokens, incluindo a diagonal. O item precisa ter sido revelado, estar numa área liberada pela névoa e, com escuridão ativa, estar dentro da visão disponível ao jogador. A visão compartilhada pode tornar o item visível; a coleta ainda usa os tokens e o inventário do próprio personagem.

A coleta leva toda a quantidade posicionada para uma nova entrada do inventário, remove o token do chão e reproduz um efeito breve até o personagem. A animação fica sob a névoa e a escuridão. Depois, apenas o jogador que iniciou a coleta recebe a ficha completa do item na tela. Se houver outro formulário aberto, a ficha aguarda seu fechamento. Atualizações e reconexões não repetem a ficha: ela é acionada pelo sucesso daquela coleta, com deduplicação por item recebido. O inventário permite reabrir a ficha depois.

Antes da coleta, os jogadores recebem apenas nome no mapa, categoria, retrato, raridade e quantidade. Descrição e propriedades são entregues ao portador após coletar. Notas privadas do mestre nunca são incluídas na projeção dos jogadores. Vínculos para o diário continuam respeitando as permissões dos documentos. A entrega feita pelo mestre atualiza o inventário destinatário sem abrir uma recompensa privada na tela de outros usuários.

## Persistência e concorrência

`loot-model.mjs` implementa `lootPlace` e `lootCollect`. Os tokens de item carregam um snapshot privado em `token.loot`, são normalizados como objetos sem personagem e sem visão própria e não podem ser movidos por jogadores. A criação é exclusiva do mestre. A coleta revalida personagem, cena ativa, revelação, proximidade, névoa e visão dentro de cada tentativa transacional. Quantidade e versão são conferidas novamente.

A transferência e a remoção do chão são salvas na mesma revisão da campanha. Se duas pessoas tentam recolher o mesmo objeto, apenas uma recebe a cópia. Falhas de espaço no inventário ou de gravação não consomem a recompensa. O catálogo não precisa continuar existindo para que uma cópia posicionada seja coletada. Os limites de 1000 itens/512 KB de inventário e os limites globais de armazenamento da campanha continuam aplicáveis.

O resultado privado da ação contém o identificador do item recebido. SSE e polling da mesa só levam eventos curtos de animação, sem ficha completa ou notas privadas. Eventos relativos a entregas ocultas do mestre ficam fora das projeções públicas. Os marcadores de animação expiram; ativação de cenas e restauração de backup descartam eventos antigos. Os objetos ainda no chão e os itens já coletados fazem parte do backup portátil. Os retratos enviados pelo mestre são incluídos no backup, inclusive os usados apenas em cenas privadas. Retratos externos antigos continuam preservados como links.

## Validação

Os testes cobrem transferência, exclusão do chão, privacidade, duas coletas concorrentes, revalidação em retry, inventário cheio, fontes de visão, pincéis de névoa, cenas privadas, versões, snapshot independente, backup, HTML escapado, fila de recompensa e troca de campanha. A interface simulada verifica colocação pelo mestre e coleta pelo jogador até a abertura da ficha no modal. A animação também é verificada para não se repetir em snapshots ou remontagens; redução de movimento omite o deslocamento e a espera da recompensa.
