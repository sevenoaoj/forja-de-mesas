# Avaliação do projeto — novembro de 2026

A Forja já reúne fichas universais e D&D aberto, composição modular, rolagens animadas e privadas, mesa com cenas/sessões, névoa livre, prévias de movimento, biblioteca de PDFs, escudo e áudio compartilhado. A prioridade desta rodada foi reduzir perda de trabalho, tornar estruturas reutilizáveis e organizar descobertas de campanha.

## Entregas selecionadas

| Área | Melhoria | Utilidade e limites |
| --- | --- | --- |
| Fichas | Histórico privado e restauração versionada | Recupera conteúdo anterior a alterações salvas. Até 20 registros por ficha; cópias expiram conforme orçamento. Mantém foto, dono e visibilidade atuais. Não substitui backup. |
| Preparação | Modelos universais pessoais ou compartilhados na campanha | Salva campos, perícias, recursos e fórmulas; permite importar/exportar JSON e criar personagens. Aparência e habilidades são opcionais. Exclui identidade, valores atuais e retratos. D&D mantém sua criação guiada. |
| Campanha | Diário com notas, pistas, personagens, locais e missões | Privado por padrão; compartilhamento para todos ou donos de fichas selecionadas, segredos exclusivos do mestre, busca e conclusão de missões. Conteúdo em texto, sem editor HTML arbitrário. |
| Mesa ao vivo | Ordenação de commit de tokens, reconexão progressiva e fechamento de streams inválidos | Evita retorno visual à posição antiga e conexões órfãs. Preserva tokens sob a névoa visualmente e acompanha suas posições globalmente. |
| Privacidade | Rolagens identificadas pela ficha | Personagens com nomes iguais deixam de interferir no filtro de rolagens de fichas ocultas. |

As referências e distinções entre anúncios e funções disponíveis estão em [PESQUISA-RPGPEDIA.md](PESQUISA-RPGPEDIA.md) e [PESQUISA-TABLETOPS.md](PESQUISA-TABLETOPS.md). O histórico e os modelos respondem a oportunidades publicamente anunciadas pela RPGpédia; o diário adota princípios documentados pelo Foundry e Roll20. Nenhuma dessas referências comprova a arquitetura interna dos produtos.

## Próximas melhorias recomendadas

1. **Backup completo de campanha e arquivos, com restauração validada.** Maior lacuna restante para um servidor instalado no computador pessoal. Precisa transportar dados e uploads sem sobrescrita silenciosa, caminhos arbitrários ou exposição de chaves de mestre.
2. **Áreas táticas dimensionadas pela escala da cena.** Círculos, cones e linhas para alcance; complementam régua e desenho existentes. Não devem automatizar dano ou impor D&D às fichas universais.
3. **Pinos no mapa ligados ao diário.** Reutilizar exatamente as permissões dos documentos; esconder o pino não deve ser a única proteção do conteúdo.
4. **Duração opcional de condições.** Contadores de rodadas com semântica definida para voltar turnos, editar iniciativa e mudar cenas.
5. **Separar progressivamente a aplicação principal em controladores.** Novas ferramentas usam módulos próprios; o arquivo central ainda concentra rotas de interface e formulários. Uma reescrita ampla durante mudanças funcionais elevaria o risco de regressão.

## Restrições operacionais

O estado continua armazenado por campanha, com atualização por revisão e recuperação de conflitos. Diário, modelos e histórico têm limites agregados de 512, 384 e 384 KiB respectivamente; o teto total da campanha também continua valendo. A interface informa rejeições e não considera uma edição salva antes da resposta do servidor. No canal da mesa são enviados apenas marcadores das ferramentas, sem repetir bibliotecas completas em cada movimento.

A validação automatizada cobre módulos, permissões, projeções públicas, ações da API, interface simulada e empacotamento. O ambiente de execução desta revisão não permite abrir a porta TCP para um teste real entre PC e celular; o teste de rede identifica essa limitação. Recomenda-se a verificação final na rede local do mestre após substituir o executável e reiniciar o servidor.

## Resultado da validação

A suíte `npm test` concluiu com 260 testes aprovados, zero falhas e um teste de TCP ignorado porque o ambiente bloqueia a abertura de portas. Inclui o fluxo de interface simulada para salvar/aplicar modelo, restaurar histórico e publicar/recolher documentos, além das verificações de autorização e concorrência. `npm run build`, o empacotamento Linux e `--check` também concluíram. O teste de conexão real PC/celular continua dependente da rede local do usuário.
