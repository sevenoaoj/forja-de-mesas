# Mapa e névoa da mesa

Pesquisa e implementação em 11 de novembro de 2026.

## Referências e escolhas

- [Foundry — Scenes](https://foundryvtt.com/article/scenes/). Separa a imagem de fundo da configuração da cena. A Forja passa a guardar as dimensões da imagem e uma calibração em pixels por célula, com alternativa manual.
- [Owlbear — Scenes](https://docs.owlbear.rodeo/docs/scenes/). Apresenta alinhamento da imagem e configuração do grid durante a importação. A Forja informa as dimensões e o número de células antes do envio e permite recalibrar depois.
- [Owlbear — Fog](https://docs.owlbear.rodeo/docs/fog/). Usa transparência para o mestre e uma prévia opaca para conferir o resultado dos jogadores. A Forja adota esses controles locais, distingue revelar e ocultar por cor e oferece desfazer para corrigir operações.

## Comportamento implementado

A grade automática usa `ceil(largura / pixelsPorCélula)` e `ceil(altura / pixelsPorCélula)`. O limite atual é de 4 a 80 células em cada eixo. Imagens grandes elevam automaticamente os pixels por célula para respeitar o limite. Células parciais recebem espaço adicional à direita e abaixo. A imagem usa a mesma escala nos dois eixos. No modo manual, a imagem cabe integralmente no grid quadrado escolhido.

A névoa usa uma máscara SVG com traços livres e regiões retangulares. O modo retangular continua disponível para operações na grade. A prévia de arraste usa o mesmo arredondamento e os mesmos limites do comando enviado ao servidor, incluindo as células da borda. A seleção tem preenchimento translúcido, contorno tracejado e dimensões no status. O mestre recebe hachuras e opacidade local ajustável. A cobertura dos jogadores é opaca.

A prévia dos jogadores afeta apenas o mapa local do mestre. Ela oculta somente os tokens marcados como secretos pelo mestre, sem alterar o estado compartilhado. Os detalhes e as ferramentas do mestre permanecem acessíveis fora do mapa.

O histórico conserva as dez últimas operações de névoa no servidor e fica fora das respostas para jogadores. Cada operação e seu desfazer passam pela validação de mestre e pela atualização concorrente já usada na campanha. Alterações de dimensões ou troca de imagem invalidam o histórico, evitando restaurar revelações de outra geometria.

A névoa é uma ferramenta de apresentação e exploração manual. O navegador continua recebendo a imagem original. O servidor filtra apenas os tokens marcados como ocultos pelo mestre e os participantes de combate relacionados. Tokens liberados continuam sincronizados abaixo da camada visual da névoa. Visão dinâmica por paredes e iluminação não fazem parte desta alteração.

## Verificação

Testes cobrem calibração e proporção em mapas verticais e horizontais, bordas incompletas, mudança entre modos, upload e validação de dimensões, recorte e restauração da névoa, filtragem de tokens, controles locais, prévia de arraste e cancelamento.

## Pincel de névoa livre

A ferramenta **Névoa** começa em **Pincel livre**, independente do encaixe dos tokens e das linhas da grade. Ajuste **Diâmetro do pincel** entre 10 e 300 pixels da imagem; o cursor circular mostra o alcance na escala atual do mapa. Arraste com o esquerdo para revelar e com o direito para encobrir. Um clique aplica um círculo. No celular, use o seletor Revelar/Ocultar e arraste com o dedo. **Formato → Retângulo na grade** restaura a ferramenta anterior.

A prévia mostra o traço em verde ou laranja. Soltar aplica o gesto inteiro ao servidor; Escape descarta. O botão do meio navega sem pintar. Desfazer reverte um gesto inteiro, incluindo sua combinação com áreas retangulares anteriores. Traços e retângulos são aplicados na ordem: é possível revelar uma sala, cobrir um móvel com o pincel e revelar outra passagem depois. Cobrir tudo e Revelar tudo compactam a composição, conservando a possibilidade de desfazer.

Os traços usam coordenadas contínuas, extremidades arredondadas e até 600 pontos por gesto (com reamostragem de gestos longos no cliente). Há até 150 operações vetoriais e 4000 pontos na composição. Esses limites mantêm a máscara e o histórico manejáveis no servidor local. A suavização de borda se adapta ao menor pincel usado, preservando recortes finos.

O servidor mantém a validação de mestre para a edição da névoa. A visibilidade dos tokens é independente do desenho de revelação: suas posições permanecem rastreadas, e a máscara visual da névoa pode encobrir seus marcadores. O controle explícito Ocultar dos jogadores continua sendo validado pelo servidor. As revelações antigas são preservadas. Trocar o mapa limpa a composição; mudar as dimensões limita os traços ao mapa e invalida o histórico anterior.

Testes cobrem curvas fracionárias, raio, círculos por clique, mistura com retângulos, ordem de composição, recortes fracionários e independência entre névoa e visibilidade dos tokens, desfazer/cancelar, controle de mouse/toque, navegação pelo botão do meio e limpeza ao trocar mapa. Não houve inspeção visual em navegador real neste ambiente.

## Tokens rastreados e visibilidade manual

A névoa cobre o mapa e os desenhos; os tokens são renderizados abaixo dela e continuam sincronizados com todos os participantes da cena pública. Revelar, encobrir ou desfazer a névoa não modifica a lista de tokens nem suas posições. Jogadores podem mover seus próprios tokens liberados mesmo em áreas encobertas; bloqueio e propriedade continuam sendo exigidos.

O mestre seleciona o token e usa **Ocultar dos jogadores** ou **Mostrar aos jogadores** diretamente na seleção. A opção equivalente permanece no editor. Um token oculto aparece atenuado para o mestre e é retirado dos dados, prévias de movimento e combate enviados aos jogadores. A prévia dos jogadores também respeita essa ocultação explícita.

Ao retornar ao aplicativo no celular ou recuperar a rede, o cliente descarta prévias transitórias antigas, reinicia o canal ao vivo e busca o estado completo sem alterar sua câmera. Consultas periódicas não se acumulam: há uma por vez, com tempo limite; a retomada substitui uma consulta pendente. Atualizações atrasadas e mensagens sem uma lista completa de tokens não apagam marcadores existentes. Um estado completo pode recriar tokens ausentes sem duplicá-los.

Testes cobrem dois clientes recebendo a mesma posição sob névoa, reconexão, retomada da aba, ocultação manual, recuperação de marcador ausente e descarte de mensagens antigas. Isso não confirma ainda o comportamento no aparelho físico do usuário.
