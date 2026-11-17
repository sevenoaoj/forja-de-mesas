# Forja de Mesas

Ambiente de RPG de mesa em português, inspirado em [C.R.I.S.](https://crisordemparanormal.com/sobre-o-cris) e [RPGpédia](https://rpgpedia.com/).

## Rodar localmente

Use Node.js 22.13 ou superior. O projeto usa o SQLite embutido no Node e dispensa a instalação de dependências.

```sh
npm start
```

Abra http://localhost:3000. A tela inicial mostra suas campanhas salvas neste navegador, sem abrir ou criar uma campanha de exemplo. Use **Nova campanha** para começar e escolha Sistema livre ou D&D 2024. Links de convite continuam abrindo diretamente a mesa convidada.

O servidor aceita conexões na rede local por padrão e mostra os endereços do computador no terminal. No celular, conectado à mesma rede Wi-Fi, abra o endereço `http://IP-DO-PC:3000` exibido. Ao gerar um convite no PC, o aplicativo usa um endereço da rede local. Use `npm start -- --local` para aceitar conexões somente no PC. Para jogar pela internet, hospede o servidor com HTTPS e armazenamento persistente. O servidor aceita `PORT` e `FORJA_DATA_DIR`; os dados ficam em `${XDG_DATA_HOME:-$HOME/.local/share}/forja-de-mesas` por padrão, tanto com npm quanto no executável. Instalações antigas com `.data/forja.sqlite` continuam usando esse diretório; se os dois bancos existirem, o servidor pede uma escolha explícita com `FORJA_DATA_DIR`.

## Acesso remoto

A Forja inicia diretamente pelo Node.js, sem instalar nem iniciar serviços de túnel. Você escolhe como disponibilizar o servidor: rede local, rede privada ou um endereço público com HTTPS.

Quando o endereço que os jogadores usam é diferente do endereço aberto pelo mestre, configure a origem dos convites:

```sh
FORJA_PUBLIC_URL=https://mesa.example.com npm start
```

Substitua pelo endereço real do seu servidor. Essa variável apenas define o endereço dos convites: ela não cria um domínio, túnel ou certificado. Também é possível informar o endereço em **Convidar jogadores**. Se o proxy está no mesmo PC e precisa de acesso somente local, use `npm start -- --local`; para aceitar conexões da rede, use `npm start -- --lan`.

Mantenha o PC e o servidor ligados durante a sessão. Para trocar a porta, use `PORT=3001 npm start`. Os dados continuam no diretório persistente exibido no terminal. Abrir a mesa por uma origem diferente usa outro armazenamento de navegador: preserve o código de mestre e os códigos dos jogadores antes de trocar o endereço. Atualize os convites quando o endereço mudar.

## Desenvolvimento e GitHub

```sh
git clone https://github.com/sevenoaoj/forja-de-mesas.git
cd forja-de-mesas
npm test
npm run build
npm start
```

O repositório contém código, testes, documentação e os recursos estáticos da aplicação. Campanhas, arquivos enviados, backups, bancos locais, credenciais e configurações locais de ferramentas ficam fora do Git. Use o backup `.forja` da própria aplicação para transportar campanhas. A configuração local de hospedagem em `.openai/` é opcional para gerar o build e fica fora do repositório. O GitHub Actions executa os testes e o build em cada push e pull request; publicar o código no GitHub não hospeda o servidor da mesa.

## Jogar

- Em uma ficha aberta, **Cores e recursos** permite escolher o destaque e a cor de cada barra com seletores de cor. Cada recurso pode ter um alerta crítico com limite percentual próprio. As barras animam ao mudar de valor e respeitam movimento reduzido. Veja [Cores e recursos da ficha](FICHA-RECURSOS.md).
- Em **Fichas**, o mestre configura um modelo por campanha. Abra um personagem e clique nos nomes, valores e textos para editar diretamente. Os controles de retrato, campos, perícias e habilidades ficam disponíveis na própria ficha. As perícias podem usar um atributo ou uma base manual, com bônus e outros modificadores. Use os botões dos contadores e dos dados durante a sessão.
- No **Diário**, o mestre prepara pistas, personagens, locais e missões. Cada documento começa privado, pode ser compartilhado com todos ou apenas com os donos dos personagens selecionados e mantém notas exclusivas do mestre. Há busca, categorias e controle de conclusão de missões.
- Em **Fichas**, **Modelos** permite guardar estruturas universais, compartilhar na campanha e importar/exportar JSON. Valores atuais, retratos e permissões não são copiados. O **Histórico** registra alterações e oferece restauração para o dono e o mestre. Veja [HISTORICO-FICHAS.md](HISTORICO-FICHAS.md) e [DIARIO-CAMPANHA.md](DIARIO-CAMPANHA.md).
- Em **Mesa virtual**, use zoom, navegação, régua e ping para explorar a cena. O mestre ajusta a grade e a escala, revela áreas com a névoa, desenha zonas e controla tokens com retrato, tamanho e condições. O combate da mesa tem iniciativa pública e controle de rodadas. Participantes podem mover tokens liberados e rolar expressões como `2d6+3` e `1d20+1d10`. A [avaliação das ferramentas](MESA-VIRTUAL.md) reúne as referências e os limites da implementação.
- O **Escudo do mestre** tem cartões privados de notas, tarefas, tabelas sorteáveis e referências para fichas, regras e páginas de PDFs. Permite fixar, recolher, buscar e reordenar cartões; traz resumos configuráveis das fichas, recursos, rolagens privadas e o combate sincronizado com a mesa. Consulte [ESCUDO-MESTRE.md](ESCUDO-MESTRE.md).
- Na **Biblioteca**, o mestre envia PDFs de até 24 MB. Qualquer participante com acesso à campanha pode consultá-los.
- O botão **Convidar jogadores** cria um link de acesso compartilhado. Quem entra pelo link escolhe uma ficha disponível ou cria seu personagem. Cada jogador acessa os detalhes e edita apenas a própria ficha, e move os tokens vinculados a ela. Notas privadas, modelo da ficha e uploads de mapas, livros e efeitos ficam sob controle do mestre.

O vínculo entre jogador e personagem fica salvo no banco do servidor. O navegador lembra a identificação por cookie persistente HttpOnly e também guarda as chaves locais para recuperação; ao abrir um convite, a aplicação tenta recuperar essa identidade antes de cadastrar outro jogador. Preserve os dados desse navegador e faça backup do diretório de dados do servidor. A mesa usa SSE para movimentos e atualizações ao vivo, com recuperação por consultas periódicas; as demais telas consultam o estado compartilhado a cada 2,5 segundos.

## Persistência, backups e recuperação de acesso

A tela reabre automaticamente a última campanha deste navegador. Se o servidor reiniciar, responder com erro ou estiver usando outro banco, o acesso salvo continua guardado: uma falha de conexão não remove mais a campanha da lista. A remoção da lista exige ação explícita.

O servidor mostra **Dados persistentes** no terminal e, antes de abrir uma instalação com campanhas existentes, cria um backup consistente do SQLite e copia os arquivos enviados para `backups/` dentro do diretório de dados. São mantidos os cinco backups de inicialização mais recentes. O banco inclui as gravações já confirmadas, inclusive quando há um arquivo WAL. Esses backups guardam o estado anterior à inicialização; para proteger alterações durante uma sessão, copie o diretório com o servidor parado ou use uma ferramenta de backup consistente.

Em **Backup e acesso** (mestre) ou **Meu acesso** (jogador), é possível baixar um código privado que reabre a campanha em outro endereço ou navegador. Na tela inicial, **Recuperar acesso** aceita esse código ou um link de acesso completo. Esse código recupera a autorização e não substitui um backup dos dados. Entregue códigos de mestre somente ao responsável pela campanha.

Se o acesso do navegador já foi perdido, o administrador do servidor pode listar as campanhas e gerar um novo arquivo com o acesso existente, sem modificar personagens, cenas ou permissões:

```sh
npm run recover -- --list
npm run recover -- ID-DA-CAMPANHA
npm run recover -- ID-DA-CAMPANHA --character=Gabriel
```

Os comandos de recuperação abrem o banco apenas para leitura, gera uma cópia do banco e arquivos em `.recovery/backups/` e salva o código de mestre em `.recovery/`. O token não é exibido no terminal nem enviado por uma API pública. Selecione o banco correto com `FORJA_DATA_DIR` quando necessário. Para restaurar dados de um backup, pare o servidor, preserve o diretório atual e inicie com `FORJA_DATA_DIR` apontando para uma cópia completa do backup escolhido.

## Reconectar ao mesmo personagem

Reiniciar o servidor não troca a identificação dos participantes. Cada jogador tem uma chave persistida em `state.members`; `ownerId` da ficha aponta para essa identificação. Ao entrar novamente, a aplicação tenta restaurar a sessão anterior antes de criar outro membro. Isso vale também para quem usa o convite público novamente. A sessão é lembrada por um ano e renovada ao reabrir a campanha, usando cookie HttpOnly por campanha; em HTTPS, o cookie também é Secure. As ações continuam exigindo a chave explícita de autorização.

Se o armazenamento local do navegador estiver vazio, mas o cookie ainda existir no mesmo endereço, a última campanha e o personagem são recuperados automaticamente. Se o servidor estiver fora do ar ou responder temporariamente sem a campanha, as chaves são preservadas e a reconexão é repetida automaticamente. Trocar de domínio, limpar todos os dados do navegador ou usar outro aparelho exige o código privado do jogador.

O jogador pode baixar esse código em **Meu acesso → Baixar código**. Se já perdeu a identificação, o mestre abre a ficha original e usa **Recuperar acesso do jogador**. O jogador cola o código em **Recuperar acesso**, na tela inicial ou em **Suas campanhas**. Esse procedimento recupera a identificação original com ficha, diário e mensagens; não cria uma cópia da ficha e não exige liberá-la para outro participante. No visual personalizado, o mestre pode alternar para **Padronizada** para acessar os controles do painel Geral.

O administrador local também pode gerar o mesmo código com `npm run recover -- ID-DA-CAMPANHA --character=Gabriel`. Quando há nomes repetidos dentro da campanha, use o ID do personagem. A recuperação é somente leitura no banco e só o código do participante escolhido é salvo em `.recovery/`.

Os testes de regressão fecham e reabrem o banco cinco vezes, reaplicam a inicialização do esquema e conferem que todos os dados, membros e vínculos continuam iguais. Também cobrem recuperação por cookie sem armazenamento local, reentrada pelo convite sem duplicar jogador, retomada após indisponibilidade e restrições de acesso aos códigos privados.

## Narração privada e edição direta

O mestre pode abrir **Mensagem privada**, no topo da tela, escolher um personagem controlado por um jogador e enviar um título e uma narração de até 4000 caracteres. O destinatário recebe uma janela central com fundo escurecido e identificação destacada de **MENSAGEM DO MESTRE**, inclusive sobre outros editores abertos. O mestre escolhe atmosfera, cores de texto/fundo/destaque, uma de cinco fontes, tamanho, alinhamento e entrada instantânea ou caractere por caractere (8–80 caracteres/s). Há uma prévia estática e outra com animação antes do envio; a última aparência usada fica salva neste navegador por campanha. As fontes têm alternativas locais e não exigem novos downloads. A mensagem fica aberta até **Entendido** ou **×**. Durante a escrita, **Revelar texto completo** apenas termina a animação; um primeiro fechamento também revela o restante sem confirmar a leitura. A preferência de reduzir movimento mostra o texto completo. As cores são validadas para preservar contraste; o mestre consulta as mensagens recentes e a confirmação de leitura no mesmo painel. As mensagens pendentes ficam salvas para a próxima conexão. Há até 100 pendentes por campanha; confirmações antigas são mantidas em um histórico limitado. O conteúdo é filtrado no servidor em consultas, sincronizações e SSE. Trocar o dono da ficha não entrega as mensagens antigas ao novo jogador.

No diário, **Novo registro** permite ao jogador escrever notas, histórias e inventário. Registros privados ficam disponíveis ao autor e ao mestre. O autor pode compartilhar com todos ou com personagens escolhidos, e só pode editar ou excluir os próprios registros. As notas exclusivas do mestre continuam protegidas, inclusive quando o jogador edita o conteúdo do próprio documento. A categoria **Inventário** é um registro de texto livre, sem contabilização automática de itens.

Na ficha padronizada ou personalizada, clique no nome, conceito, cor, valor de atributo, recurso ou texto para editar no lugar. **Enter** ou sair do campo salva; **Escape** cancela. Em textos longos, Enter quebra a linha e **Ctrl+Enter** salva. Recursos usam `atual/máximo`, como `8/10`. Nomes de perícias, modificadores manuais e descrições de habilidades também aceitam edição direta. Valores calculados pelo sistema continuam automáticos. Alterações entram no histórico; se o mesmo campo mudar em outra aba, a gravação é recusada e o rascunho permanece visível para não perder o que foi digitado. As opções de vínculo de perícias, estrutura e fórmulas continuam em seus controles próprios.

## Backup no computador do mestre

Com a campanha aberta, escolha **Backup e acesso → Baixar backup completo**. O arquivo `.forja` inclui todas as sessões/cenas, fichas e histórico, mapas, retratos, PDFs, efeitos enviados, playlists, diário e notas privadas do mestre. Salve uma cópia depois de cada sessão.

Para recuperar, use **Importar backup** na tela de campanhas ou no menu **Suas campanhas**, mesmo sem conseguir abrir a campanha antiga. A importação cria uma nova campanha com novos acessos, sem sobrescrever a original. Envie o novo convite: os jogadores escolhem suas fichas novamente. A música começa parada; as playlists são preservadas. Links do YouTube são guardados, os vídeos não são baixados.

O arquivo completo tem limite de 100 MB, com até 90 MB de uploads e os limites normais de estado da campanha. Cada conteúdo possui verificação de integridade; arquivos incompletos ou corrompidos não criam uma campanha parcial. O **código de acesso** continua disponível separadamente: ele reabre dados existentes no servidor, enquanto o **backup completo** permite recuperar os dados. Consulte [BACKUP-CAMPANHA.md](BACKUP-CAMPANHA.md).

## Escuridão e campo de visão

Na **Mesa virtual**, o mestre ativa a escuridão pelo botão de lua ou em **Configurar mesa**. A configuração pertence à cena e permite visão individual ou compartilhada pelo grupo. O mestre alterna esse modo diretamente pelo botão **Visão: individual / compartilhada**. Com a escuridão ativa, ele vê todos os cones simultaneamente; **Cones** recolhe essas guias só na sua tela. Tokens ocultos aparecem com cone tracejado apenas para o mestre. Ao editar um token, configure **Campo de visão**: alcance na unidade da grade, abertura (1–360°) e direção inicial.

Selecione seu token e arraste a seta na borda para apontar a visão. Também há um controle deslizante, botões para girar 15°, teclas **Q/E** e **Shift + roda do mouse**. Os jogadores só giram tokens próprios e desbloqueados. O mestre pode selecionar um token e usar **Ver pela visão deste token**.

O alcance acompanha a escala do mapa e o cone segue o movimento local e as prévias ao vivo. A névoa manual continua cobrindo áreas por cima da visão. Paredes desenhadas na imagem não bloqueiam o cone automaticamente. Detalhes e referências: [ESCURIDAO-E-VISAO.md](ESCURIDAO-E-VISAO.md).

## Itens interativos no mapa

Prepare o item no **Inventário** e use **Colocar na mesa** (ou **Colocar item**, na mesa virtual). Escolha quantidade e posição; a cópia começa oculta e pode ser revelada ao selecionar o token. O retrato ou ícone da categoria identifica o objeto.

O jogador aproxima seu personagem e abre o objeto por duplo clique, Enter ou **Coletar item**. A coleta transfere a quantidade ao inventário, remove o objeto do chão, mostra uma animação e abre a ficha completa somente para o jogador que coletou. Coletas simultâneas são protegidas contra duplicação. Veja [ITENS-NA-MESA.md](ITENS-NA-MESA.md).

## Build hospedado

`npm run build` gera um Worker ESM em `dist/server/index.js`, com os arquivos da interface incorporados. O Worker usa os bindings `DB` (D1) e `BUCKET` (R2). A migração em `drizzle/` também inicializa o banco SQLite local.

## Áudio da campanha

Na aba **Áudio**, o mestre prepara sessões musicais, adiciona seus links do YouTube e escolhe qual faixa tocar. O repertório começa vazio. Em **Áudio → Soundboard**, o mestre prepara sessões com pacotes inteiros ou sons escolhidos à mão. O painel flutuante de áudio toca a seleção atual em qualquer aba. Há pré-escuta local, favoritos, repetição e parada geral. Quatro pacotes CC0 do Kenney (350 arquivos nas fontes originais) podem ser baixados e instalados pela interface; também é possível importar ZIPs de até 32 MB e enviar áudios individuais de até 8 MB. Consulte [SOUNDBOARD.md](SOUNDBOARD.md). Cada jogador recebe um aviso para **Ativar som da mesa** no próprio navegador. O gesto também é iniciado ao escolher ou criar o personagem. Se o YouTube bloquear a reprodução automática, o aviso pede uma nova ativação. O volume da música combina o volume definido pelo mestre, o fade compartilhado e o ajuste local de cada aba. Os efeitos mantêm seu volume local. Os controles de trilha e soundboard são exclusivos do mestre.

A mesa compartilha os comandos de tocar, pausar, reiniciar e encerrar por uma linha do tempo no servidor. Os comandos têm uma janela de preparação de 1,2 segundo, somada ao fade de saída configurado, e o áudio é consultado a cada 400 ms. O player mantém a posição da mesa e corrige desvios de reprodução. Use vídeos que permitem incorporação. Atrasos de rede, carregamento do YouTube e políticas de reprodução do navegador podem afetar o início em cada aparelho.

## Preparar o soundboard da sessão

1. Abra **Áudio → Soundboard** e crie uma sessão com o nome da sua partida.
2. Em **Pacotes**, use **Baixar e ativar nesta sessão** nos pacotes desejados. O servidor precisa de internet na primeira instalação. Depois de instalados, os arquivos ficam salvos com a campanha e dispensam a fonte externa.
3. Para usar só alguns sons, desligue o pacote inteiro na sessão, abra **Biblioteca** e marque **Separar à mão para esta sessão** nos efeitos desejados. Você pode misturar vários pacotes e seus próprios arquivos.
4. Em **Da sessão**, teste com **Ouvir só eu**, marque favoritos e ajuste o volume da mesa. O botão grande de cada som toca para todos os participantes que ativaram o áudio.
5. Durante a partida, abra o botão flutuante de áudio e o **Soundboard da sessão**. A seleção, busca e reprodução funcionam nas fichas, diário, mesa e demais abas. **Repetir** mantém até quatro efeitos contínuos; **Parar todos os efeitos** interrompe os efeitos compartilhados sem parar a música.

A seleção de pacotes, sons avulsos e favoritos é independente em cada sessão do soundboard. Trocar a sessão interrompe efeitos antigos e mantém a preparação salva. Excluir uma sessão remove a seleção; os arquivos continuam na biblioteca. Excluir um arquivo remove-o das seleções e loops que o utilizavam. Pacotes e escolhas entram no backup completo `.forja`; uma cópia restaurada começa sem efeitos em repetição.

O catálogo inclui **RPG e exploração (50)**, **Combate e impactos (130)**, **Ficção científica (70)** e **Pistas e interface (100)**, todos do Kenney sob CC0. Esses números são os anunciados nas fontes; a interface mostra o número de áudios efetivamente importados. Se a conexão do servidor impedir o download, abra **Fonte e licença**, baixe o ZIP no seu navegador e use **Importar pacote ZIP**. Sons de outras fontes podem ser organizados do mesmo modo, com autor, origem e licença registrados.

## Executável Linux

```sh
./releases/forja-de-mesas-linux-x64
```

Abra http://localhost:3000. O arquivo inclui o Node.js para Linux x86-64 com glibc. O acesso pela rede local já vem habilitado. O terminal mostra o endereço para abrir no celular conectado ao mesmo Wi-Fi. Use `--local` para restringir o servidor ao próprio computador, e `--check` para verificar o pacote sem abrir uma porta. Use `Ctrl+C` para encerrar o servidor.

O executável guarda as campanhas e os arquivos em `${XDG_DATA_HOME:-$HOME/.local/share}/forja-de-mesas` por padrão. Para carregar dados de uma instalação anterior, aponte `FORJA_DATA_DIR` para o diretório usado pelo servidor anterior. Para gerar o pacote novamente, rode `./scripts/build-linux.sh`.

## Usar a mesa virtual

- Em **Configurar grade**, escolha colunas, linhas, escala, unidade e a regra de distância. A grade pode ficar oculta e o encaixe dos tokens pode ser desativado.
- Arraste o espaço vazio para navegar ou selecione **Mover visão**. A roda do mouse e os botões de zoom controlam a aproximação. **Ajustar mapa à tela** centraliza a cena.
- Com **Medir**, arraste entre dois pontos. **Apontar** envia um ping temporário ao grupo.
- O mestre pode criar linhas, retângulos e elipses em **Desenhar**. Na ferramenta **Névoa**, selecione revelar ou ocultar e arraste uma área.
- Selecione um token para consultar suas condições, abrir a ficha vinculada ou editar suas propriedades. Use as setas do teclado para movê-lo.
- Em **Iniciativa → Organizar**, adicione participantes ou os tokens da mesa. Os botões de turno avançam ou recuam a ordem e a rodada.

A névoa controla a exploração visual, e o navegador recebe o mapa original. O servidor filtra os tokens marcados como ocultos pelo mestre e os participantes de combate ligados a eles; as posições continuam sincronizadas mesmo quando o token fica visualmente encoberto pela névoa. O convite permite criar uma identificação individual de jogador neste navegador. A movimentação fica restrita aos tokens da ficha escolhida.

## Verificação

Execute `npm test` para verificar permissões, névoa, campanhas existentes, turnos concorrentes e interações da mesa em DOM simulado. Use `npm run build` para gerar o Worker, ou `./scripts/build-linux.sh` para atualizar o executável Linux.

## Celular e conexão

No celular, use o endereço do PC mostrado pelo servidor e mantenha os dois dispositivos na mesma rede. O link de convite gerado no PC já usa esse endereço quando ele pode ser detectado. Se houver várias interfaces de rede, escolha a conexão Wi-Fi ou Ethernet no convite.

Após atualizar o executável, encerre a instância anterior com Ctrl+C e inicie a nova versão. Se a conexão continuar recusada, confirme que o processo está aberto, que a porta exibida é a mesma do link e que o firewall do PC permite acesso a essa porta pela rede local. Redes Wi-Fi de convidados podem bloquear a comunicação entre dispositivos.

A interface para celular tem navegação inferior, campos e botões maiores, fichas em coluna e controles de mesa com rótulos. Use dois dedos para ampliar e navegar pelo mapa. Após selecionar um token, os botões de direção permitem movê-lo sem arrastar a miniatura.

Para diagnosticar uma conexão recusada ou que expira, mantenha o servidor aberto e execute o pacote em outro terminal com `--diagnose`. O comando testa a aplicação pelo endereço local e pelos IPs da rede e imprime os resultados sem exibir chaves de acesso da campanha.

```sh
./releases/forja-de-mesas-linux-x64 --diagnose
```

Se o PC responder e o celular continuar sem conectar, confirme o endereço exato usado no telefone e a saída de `ss -ltn | grep ':3000'` no PC. Uma escuta em `127.0.0.1:3000` aceita apenas acesso local. A escuta em `0.0.0.0:3000` aceita IPv4 nas interfaces da rede; o firewall e a rede Wi-Fi também precisam permitir a conexão. Para testar a resposta HTTP pelo celular, abra `http://IP-DO-PC:3000/api/health`.

## Personagens e privacidade

Ao entrar pelo convite, escolha uma ficha disponível ou crie seu personagem. Cada ficha pode ter um jogador responsável. Os outros participantes veem apenas nome, conceito, cor e retrato das fichas visíveis. Valores, campos próprios, perícias e habilidades são enviados somente ao dono da ficha e ao mestre.

O mestre pode marcar uma ficha como oculta ao criar ou editar, ou usar **Ocultar dos jogadores** na tela da ficha. Ela sai das listas dos jogadores, seu retrato fica inacessível e suas rolagens vinculadas são filtradas. A aparência e a visibilidade dos tokens são configuradas separadamente na mesa. O mestre continua com acesso completo a todas as fichas.

O botão **Liberar personagem**, na ficha aberta pelo mestre, permite atribuir uma ficha a outro jogador. Ocultar uma ficha ocupada também libera esse vínculo e devolve o participante à seleção. Preserve os dados do navegador para manter sua identificação. Ao trocar de navegador ou limpar os dados, peça ao mestre para liberar a ficha.

Campanhas existentes mantêm suas fichas, inicialmente disponíveis para escolha. A autorização é conferida no servidor, inclusive para edições, retratos e movimentos. A identificação individual fica no estado persistido da campanha e dispensa uma migração de banco.

## Preparar a música de uma sessão

1. Abra **Áudio → Nova sessão** e informe o nome que você usa para a sessão.
2. Use **Adicionar música** para cadastrar cada link do YouTube com um nome e uma etiqueta opcional.
3. Durante o jogo, use a busca ou as etiquetas para localizar a faixa e clique em **Tocar**.
4. Em **Volume e fades**, ajuste o volume da mesa e as durações de entrada e saída. O padrão é 3 segundos, com ajuste de 0 a 30 segundos.
5. Use **Mais** em uma faixa para editar, reordenar ou remover. A organização do repertório é privada do mestre. Jogadores acompanham apenas a faixa compartilhada.

O mestre escolhe cada reprodução. Cadastrar faixas e selecionar uma sessão são operações de preparação. Quando uma música termina, a mesa aguarda uma nova escolha.

Na troca, a faixa atual faz fade-out, o mesmo player carrega a música escolhida e aplica o fade-in. Pausar e encerrar também usam o fade-out. Os clientes seguem o envelope pelo relógio compartilhado, e quem chega durante uma faixa consulta a posição atual. O tempo de carregamento do YouTube pode acrescentar um intervalo. Uma proteção local curta suaviza o início quando o aparelho termina de carregar depois do fade compartilhado.

O vídeo fica na aba Áudio. Um pequeno botão de áudio continua disponível nas outras telas. Ao abrir, ele mostra silêncio, volumes locais de música e efeitos, playlist do mestre e atalho para Áudio. Fechar o painel mantém a reprodução. A ativação do som abre essa aba para iniciar a reprodução com o player visível. Depois de iniciada, a música acompanha a navegação pela campanha usando a mesma instância, a linha do tempo e os comandos do mestre. Cada participante pode silenciar sua aba e ajustar seu volume local.

A [pesquisa de áudio para RPG](AUDIO-RPG.md) documenta as práticas consultadas e as referências oficiais. A implementação usa as operações do player incorporado do YouTube e preserva um único player por página.

## Identificação da trilha para jogadores

Os títulos e as referências internas preparados pelo mestre são privados. A interface própria mostra **Trilha da mesa** para os jogadores e reserva o atalho externo ao mestre.

O player incorporado do YouTube pode ser consultado na aba Áudio e pode identificar o vídeo. A integração oficial exige que o player e seus elementos sejam preservados. A ocultação dos nomes de preparação não torna o vídeo anônimo.

O painel dos jogadores usa um player de 200 × 200 pixels com controles compactos de som e volume. Esse é o tamanho mínimo documentado para o player incorporado. A imagem do vídeo permanece dentro da área do YouTube.


O envio de mapas lê a largura e a altura da imagem e cria uma grade automática com células quadradas. O mestre escolhe os pixels por célula na importação ou em **Configurar mesa**. A imagem mantém sua proporção, com espaço adicional nas bordas incompletas. O modo manual também preserva a proporção e permite escolher colunas e linhas. Mapas antigos são calibrados ao serem abertos pelo mestre. Trocar o mapa centraliza a visão e limpa as revelações da cena anterior, mantendo a névoa ativa se ela já estava ativa.

Na ferramenta **Névoa**, arraste para revelar ou ocultar. A seleção verde ou laranja mostra exatamente as células que serão alteradas e informa sua largura e altura. **Esc** cancela. A névoa do mestre tem transparência ajustável e hachuras. **Prévia dos jogadores** mostra somente no mapa do mestre a cobertura opaca e os tokens visíveis aos jogadores. O inspetor continua sendo o do mestre. **Desfazer névoa** restaura até dez operações, incluindo revelar, ocultar, cobrir tudo e ativar/desativar. Essa configuração local de aparência não altera a opacidade dos jogadores.

As decisões de mapa e névoa e suas referências estão em [MAPA-E-NEVOA.md](MAPA-E-NEVOA.md).


O mestre encontra o botão **Playlist** ao abrir o pequeno botão flutuante de áudio em qualquer tela. O painel retrátil mantém seu estado durante a navegação e oferece busca por nome/etiqueta, seleção de sessão, escolha manual de faixas e os comandos de pausar, retomar, reiniciar e encerrar. Também há volume compartilhado da música e acesso aos ajustes de fade. O controle externo continua ajustando apenas o volume da própria aba. Alterar a sessão não inicia músicas. O painel é exclusivo do mestre, e o vídeo continua na aba Áudio.


Em **Personalizar ficha**, cada personagem pode ter sua própria estrutura de até 100 campos. É possível adicionar ou remover atributos, renomear seções, reordenar campos e criar vários recursos, como Vitalidade, Mana e Fôlego. Os atalhos **Adicionar atributo** e **Adicionar recurso** já escolhem o tipo adequado. Recursos aceitam o formato atual/máximo, por exemplo `8/12`, têm controles de incremento/decremento e edição dos dois valores ao clicar no recurso. Ao salvar uma estrutura própria, ela fica independente do modelo compartilhado da campanha. O modelo continua sendo usado pelas fichas que ainda não personalizaram sua estrutura.

Em **Dados → Nova rolagem**, salve um nome e uma expressão como `2d6 + Força`, `1d20 + Agilidade - 2` ou `1d7`. O seletor insere referências a atributos e recursos, e a prévia informa a expressão numérica atual. Referências explícitas também aceitam `@{Força}`. O servidor salva o vínculo pelo identificador do campo, consulta seu valor atual em cada rolagem e preserva a referência quando o campo é renomeado. Remover um campo utilizado exige editar a rolagem correspondente; valores ausentes não são substituídos silenciosamente por zero.

As expressões aceitam somas e subtrações de até 50 dados de 2 a 1000 faces e modificadores inteiros. Campos usados em rolagens precisam ter valor inteiro entre -9999 e 9999. A referência a um recurso usa seu valor atual. Resultados são calculados no servidor e aparecem no histórico da mesa. A pesquisa e as decisões de implementação estão em [FICHAS-UNIVERSAIS.md](FICHAS-UNIVERSAIS.md).

Ao criar uma ficha, o seletor **Modelo da ficha → Os Herdeiros do Destino** prepara Poder, Astúcia, Essência, Idade, Dobra, Equipamentos, História e Anotações. Ele já inclui três testes `2d6 + atributo` e uma maestria de Essência com `1d4`, conforme as regras informadas pelo usuário. Os atributos novos começam em zero para serem preenchidos; o modelo não cadastra automaticamente o personagem Anuki. Para reproduzir o exemplo das imagens, preencha Anuki, idade 22, dobra Água (sangue), Poder 2, Astúcia 0 e Essência 1. O retrato pode ser enviado pelo controle da própria ficha.

O modelo Os Herdeiros do Destino usa o visual original em três painéis. Idade, Dobra, Equipamentos, História e Anotações aparecem no painel Geral, junto aos atributos. As fichas criadas na antiga apresentação de documento usam automaticamente os painéis, preservando seus campos, textos, retratos, rolagens e maestrias.

Na seção **Maestria da sessão**, selecione a maestria antes de clicar no teste vinculado. O dado é acrescentado e o uso é consumido junto com a rolagem no servidor. A maestria de Essência não pode ser usada no teste de Poder ou Astúcia. Na própria ficha, **Configurar** permite trocar nome, atributo e dado, conservando o uso atual. Somente o mestre pode renovar a maestria, pela ficha ou pelo botão **Nova sessão: renovar maestrias** na lista de fichas. A renovação é manual, no início de uma nova sessão de RPG.


A mesa virtual tem um painel **Dados da ficha**, organizado em **Testes**, **Ações**, **Recursos** e **Livre**. Clicar em um atributo rola somente aquele teste, com fórmula e bônus visíveis; em D&D, o destaque é o modificador, enquanto nível, deslocamento e PV temporários ficam nas informações de recursos. As perícias seguem os dados-base do sistema (2d6 em Herdeiros, 1d20 em D&D), calculadas pelo servidor com a ficha atual. Em Livre, é possível compor expressões com referências explícitas e conferir a prévia antes de rolar. O mestre pode selecionar fichas ou tokens vinculados; jogadores usam sua própria ficha, e rolagens do mestre permanecem privadas. Detalhes e referências: [DADOS-FICHA-MESA.md](DADOS-FICHA-MESA.md).

Os cartões da lista de fichas, da visão geral e da escolha de personagem exibem o retrato enviado. A imagem é carregada pelo acesso autorizado da campanha, reutilizada entre as telas e substituída pelo símbolo de identificação enquanto carrega ou se ocorrer uma falha. O cache é descartado quando muda o acesso ou quando um retrato deixa de estar disponível.


Em **Suas campanhas**, o criador pode usar **Apagar** e confirmar o nome da mesa. Isso apaga a campanha, revoga os convites e remove os arquivos enviados. Participantes podem apenas remover o atalho da própria lista. A exclusão verifica a revisão da campanha para evitar apagar dados alterados durante a operação.

A integração **D&D 2024 · SRD 5.2.1** inclui criação guiada de nível 1 com as 12 classes, 9 espécies e 4 antecedentes do documento aberto, sequência padrão ou valores aprovados pelo mestre, bônus de antecedente, perícias e especializações de ladino. Ela calcula modificadores, proficiência, salvaguardas, PV iniciais, atributos mágicos e recursos básicos. As fichas usam os painéis originais e conservam a personalização universal.

Na **Biblioteca**, abra **Consultar regras** para pesquisar referências rápidas em português. O catálogo inicial contém classes, espécies, antecedentes, regras e uma seleção de magias e armas; o PDF oficial completo cobre o restante. As opções podem ser adicionadas à ficha, criando habilidades e rolagens quando aplicável. **Conjurar** gasta um espaço de 1º círculo para as magias dessa seleção; rolagens avulsas de ataque/dano não gastam outro espaço. Vantagem e desvantagem usam dois d20 e indicam o resultado mantido, também na mesa virtual.

O mestre pode usar **Salvar livro para esta mesa** para baixar o PDF oficial em inglês pelo servidor e compartilhá-lo na biblioteca, inclusive para consultas posteriores sem internet. O download precisa de conexão do servidor. O ambiente de desenvolvimento não permitiu baixar o PDF diretamente; a importação foi verificada com respostas simuladas, incluindo falha e repetição. O link oficial permanece disponível. Créditos, referências e limites da automação: [DND-SRD.md](DND-SRD.md).


As rolagens agora têm uma apresentação animada na tela, com dados estilizados em perspectiva, resultado total e indicação dos dados descartados em vantagem/desvantagem. A animação usa os valores sorteados no servidor, sem refazer o sorteio. Rolagens públicas novas aparecem para os participantes conectados; as privadas ficam com o mestre. Em **Animar dados**, abaixo do mapa, cada participante pode desativar os efeitos. A preferência de movimento reduzido do navegador é respeitada.

O **Histórico de rolagens** fica imediatamente abaixo do mapa interativo, com ator, resultado, visibilidade e detalhes do cálculo. A atualização não remonta o mapa nem interrompe a edição dos controles de dados. São conservadas até 40 rolagens públicas e 40 privadas por campanha.

Toda rolagem feita com acesso de mestre é privada, inclusive ao usar a ficha de um personagem ou conjurar magia. O servidor filtra o histórico no acesso à campanha, nas respostas das ações e na sincronização. Dados e eventos dessas rolagens não são enviados aos jogadores. Rolagens antigas que não possuem identificação confiável do autor ficam visíveis apenas ao mestre. A pesquisa e as escolhas de animação estão em [ROLAGENS.md](ROLAGENS.md).

### Repetir a música

Marque **Repetir esta música ao terminar** ao adicionar ou editar uma faixa. Durante a reprodução, o mestre pode alternar **Repetir: ativado/desativado** nos controles da faixa atual, inclusive dentro da playlist flutuante. A repetição é compartilhada com a mesa e mantém a música escolhida; não seleciona outra faixa automaticamente.

### Ficha modular e leitura do mestre

Na ficha, use **Organizar** para arrastar os blocos na ordem desejada, usar ↑/↓ no celular e escolher larguras prontas pelo botão ⋯. O modo simples preenche os espaços entre blocos de alturas diferentes, abre espaço com uma prévia animada durante o arraste e reduz as colunas em telas menores. É possível soltar em áreas vazias e cancelar o gesto com Escape. O modo Mosaico avançado mantém as divisórias proporcionais para quem quiser esse controle. As duas leituras têm destaques por seção; cada bloco personalizado também aceita uma cor própria. Há opções de fundo, tipografia, densidade, formato da foto, espaçamento, títulos, ocultação e modelos de organização. As alterações ficam em rascunho até **Salvar aparência**.

**Personalizada** mostra a organização criada para o personagem. **Padronizada** mantém os painéis originais e todos os campos, mesmo os ocultos no mosaico. O mestre começa na visão padronizada e pode alternar sem mudar o layout salvo pelo jogador. Os valores e as fórmulas são os mesmos nas duas visões. Referências, controles e limites: [FICHA-MODULAR.md](FICHA-MODULAR.md).

### Mesa ao vivo e ferramentas de exploração

No servidor Linux, a mesa usa uma conexão contínua autenticada para compartilhar a prévia de movimento dos tokens enquanto são arrastados. Jogadores podem mover seus próprios tokens simultaneamente sem desmontar a cena dos demais; a posição final continua sendo salva no servidor. O indicador **Ao vivo** mostra a conexão; em reconexão ou hospedagem sem esse canal, a mesa recebe posições confirmadas por consulta periódica.

A névoa tem base opaca com textura e bordas suavizadas para dentro da região revelada. Na ferramenta **Névoa**, arraste com o botão esquerdo para revelar ou com o direito para encobrir; no toque, selecione Revelar/Encobrir. **Desenhar** começa em desenho livre e mantém linha, retângulo e elipse. Os pings dão um único pulso, identificam quem apontou e somem em até 1,5 segundo, sem repetir a cada sincronização. Câmera e zoom continuam individuais.

Pesquisa, decisões, limites e verificação: [MESA-AO-VIVO.md](MESA-AO-VIVO.md).

As rolagens públicas dos jogadores também chegam em todas as abas da campanha pelo canal ao vivo e abrem o mesmo popup, com resultado e cor definidos pelo servidor. A janela de personagem oferece 24 cores; o destaque personalizado salvo na organização da ficha tem prioridade na cor dos dados. O popup de iniciativa aparece somente para quem rolou; o registro continua no histórico, e rolagens do mestre continuam privadas.

Na mesa virtual, segure o botão do meio e arraste para mover a câmera em qualquer ferramenta, inclusive sobre tokens. Soltar mantém a ferramenta selecionada; essa navegação é local ao seu navegador.

A ferramenta **Névoa** agora oferece **Pincel livre** como padrão, com diâmetro ajustável e cursor circular para contornar interiores sem encaixe na grade. Esquerdo revela, direito encobre, um clique pinta um círculo e Escape cancela o gesto. O modo **Retângulo na grade** continua disponível. Os traços são compartilhados ao soltar e podem ser desfeitos individualmente.

O editor de tokens usa uma paleta visual de 24 cores e uma galeria de 30 símbolos, com prévia antes de salvar. O mestre também pode importar um retrato próprio (PNG, JPEG, WebP ou GIF, até 3 MB), inclusive para tokens independentes. Automático usa o retrato importado, o da ficha ou a inicial; Inicial força a letra; escolher um símbolo substitui o retrato. Ao selecionar um token vinculado a um jogador, **Mensagem privada** abre o editor com esse destinatário. Referências e licença: [TOKENS-VISUAIS.md](TOKENS-VISUAIS.md).

### Cenas e sessões da campanha

Na mesa virtual, abra **Cenas e sessões** para organizar mapas em sessões com nome, data e anotações privadas. Cada cena conserva mapa, tokens, névoa, desenhos, grade e combate. **Preparar** muda só a visão do mestre; **Mostrar à mesa** leva os jogadores para essa cena. Os cartões permitem editar, duplicar, ordenar e mover entre sessões. A primeira cena existente é preservada.

Fichas, recursos e áudio continuam compartilhados pela campanha. Pesquisa, privacidade, funcionamento e limites: [CENAS-E-SESSOES.md](CENAS-E-SESSOES.md).

Tokens liberados ficam abaixo da camada visual da névoa e continuam rastreados por todos, mesmo enquanto encobertos. O mestre pode selecionar um token e usar **Ocultar dos jogadores / Mostrar aos jogadores** sem abrir o editor. Ao retomar a aba no celular, o aplicativo reconecta e busca as posições atuais, descartando prévias antigas; mensagens incompletas ou atrasadas não apagam marcadores.

## Avaliação e referências

A revisão de novembro de 2026 priorizou recuperação de fichas, reutilização de modelos e documentos com permissões. A pesquisa distingue recursos anunciados de funcionalidades disponíveis: [RPGpédia](PESQUISA-RPGPEDIA.md), [outros tabletops](PESQUISA-TABLETOPS.md) e [correções internas](REVISAO-INTERNA.md). As novas bibliotecas têm limites de armazenamento e controle de versão; não substituem o backup do diretório de dados do servidor.

### Inventário integrado

O mestre prepara fichas de itens no catálogo privado e entrega cópias às fichas dos personagens. Retratos enviados pelo mestre, propriedades, quantidade, equipamento, peso total e vínculos com o diário estão disponíveis na página **Inventário** e na própria ficha. Consulte [INVENTARIO.md](INVENTARIO.md) para uso, permissões e referências pesquisadas.
