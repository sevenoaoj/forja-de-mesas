# Backup portátil da campanha

O mestre pode salvar a campanha inteira no próprio computador e restaurá-la no mesmo servidor ou em outra instalação compatível da Forja. A opção fica em **Backup e acesso → Baixar backup completo**, acessível no cabeçalho ou na visão geral. **Importar backup** está disponível na tela inicial e na lista de campanhas, mesmo quando nenhum acesso antigo funciona.

## Conteúdo e restauração

O arquivo `.forja` guarda o estado completo da campanha: todas as sessões/cenas e mapas, fichas, organização personalizada e histórico, tokens, névoa, combate, rolagens, biblioteca, modelos, diário, escudo e notas privadas. PDFs, retratos, mapas e efeitos enviados são incorporados ao arquivo. Playlists e links de YouTube são preservados, sem baixar vídeos externos.

A restauração sempre cria outra campanha; não substitui nem apaga a anterior. O navegador que importa recebe um novo acesso de mestre, salvo na lista local, e a campanha ganha outro convite. Chaves antigas e vínculos de controle dos jogadores não são transportados. Os jogadores entram pelo novo convite e escolhem suas fichas novamente; fichas ocultas continuam ocultas. Documentos seletivos continuam ligados aos mesmos personagens, passando a respeitar seus novos donos. Modelos privados ficam sob o controle do mestre da cópia. Música e efeitos começam parados para não reproduzir comandos antigos.

O backup contém conteúdo privado da campanha. O arquivo de código de acesso `.txt` continua separado e não é aceito como backup: ele depende de a campanha ainda existir no servidor.

## Formato, limites e consistência

`campaign-backup.mjs` usa um formato binário versionado sem dependências externas: assinatura, tamanho do cabeçalho, JSON de metadados/estado e corpos de arquivos com seus hashes SHA-256. O estado e cada upload têm verificação de integridade contra danos/truncamentos; isso não é uma assinatura de autoria nem criptografia. A versão atual aceita arquivos de até 100.000.000 bytes, até 90.000.000 bytes de uploads e os limites usuais de estado (1,5 MB legado/8 MB com organização de cenas). Até 500 arquivos distintos; limite individual de 40 MiB para acomodar o SRD oficial.

O download lê o snapshot do banco obtido na requisição. Uploads são lidos um por vez e conferidos contra os tamanhos referenciados; arquivos ausentes ou trocados durante a cópia interrompem o download. Evite apagar/substituir arquivos durante o backup e confira se o download terminou antes de fechar a página. A importação verifica formato, estado, manifesto, tamanhos, IDs seguros, tipos de mídia e hashes. Uma campanha só é criada depois de validar e salvar todos os uploads. Falhas apagam os uploads da cópia incompleta, sem remover os arquivos originais.

A API funciona no servidor Linux e no Worker hospedado, usando a mesma abstração de arquivos e banco. `GET /api/campaigns/:id/backup` exige acesso de mestre. `POST /api/campaigns/import` cria uma nova campanha, como a criação normal, aceitando o corpo binário. O estado nunca traz chaves de acesso originais. O limite do provedor de hospedagem também se aplica a requisições de importação; o limite escolhido fica abaixo de 100 MB.

## Verificação

`tests/campaign-backup.test.mjs` cobre cópia completa, cenas privadas, uploads idênticos, novas credenciais, restrição de download ao mestre, arquivos truncados/corrompidos, manifesto inválido, tamanhos, rollback e campanha vazia. O cenário da interface em `tests/entry-client.test.mjs` baixa um arquivo pela ação real, remove a linha original e restaura a cópia pela tela de importação, confirmando o novo acesso salvo no navegador.
