# Soundboard por sessão

## Uso

Em **Áudio → Soundboard**, o mestre cria uma sessão de efeitos, instala pacotes, ativa os que quer usar inteiros e escolhe sons individuais na Biblioteca. Escolhas avulsas continuam disponíveis se o pacote inteiro for desligado. Favoritos aparecem primeiro. O botão grande transmite o efeito para a mesa; **Ouvir só eu** é uma pré-escuta privada, inclusive quando o som local da mesa estiver silenciado. Pré-escuta não abre o player do YouTube e não envia comando aos jogadores.

O botão flutuante de áudio inclui o soundboard da sessão em todas as abas. O mestre pode buscar, tocar, favoritar, repetir e parar efeitos sem sair da tela atual. O painel conserva a biblioteca entre sincronizações parciais; jogadores recebem os comandos de reprodução e créditos, sem os controles ou a preparação privada do mestre.

As sessões do soundboard são seleções nomeadas de efeitos, independentes das playlists musicais. Elas ficam no banco da campanha, sem depender do armazenamento local do navegador. Trocar ou excluir a sessão ativa para os efeitos antigos; excluir uma preparação não apaga os áudios.

## Pesquisa e catálogo

Bibliotecas consultadas em 17/11/2026:

| Biblioteca | Resultado para esta integração |
| --- | --- |
| [Kenney: RPG Audio](https://kenney.nl/assets/rpg-audio) | 50 arquivos, CC0. Catálogo RPG e exploração. |
| [Kenney: Impact Sounds](https://kenney.nl/assets/impact-sounds) | 130 arquivos, CC0. Catálogo Combate e impactos. |
| [Kenney: Sci-fi Sounds](https://kenney.nl/assets/sci-fi-sounds) | 70 arquivos, CC0. Catálogo Ficção científica. |
| [Kenney: Interface Sounds](https://kenney.nl/assets/interface-sounds) | 100 arquivos, CC0. Catálogo Pistas e interface. |
| [Freesound: licenças e downloads](https://freesound.org/help/faq/) | As licenças variam por gravação. Há CC0, CC BY e outras condições; importação manual preserva os créditos informados pelo mestre. |
| [OpenGameArt: coleção CC0](https://opengameart.org/content/cc0-sound-effects) | Há pacotes de efeitos CC0. ZIPs podem ser importados com origem e autor. |
| [Pixabay: licença](https://pixabay.com/service/license-summary/) | Uso gratuito não equivale a permissão para redistribuir os arquivos como biblioteca. Não foi incluído um espelho de sons do Pixabay. |
| [Sonniss: licença do GameAudioGDC](https://sonniss.com/gdc-bundle-license/) | A licença permite sincronização em projetos, mas restringe o fornecimento dos sons em si, inclusive como saída de um serviço. Não foi incluído como pacote redistribuído. |

A [página de suporte do Kenney](https://kenney.nl/support) confirma CC0 nos assets e explica que a atribuição é opcional. Ainda assim, autor, fonte e licença acompanham os arquivos. Os seis efeitos sintetizados originais da Forja continuam disponíveis sem download e são identificados separadamente das gravações externas.

O download externo real foi bloqueado pelo DNS do ambiente de desenvolvimento. Os quatro pacotes foram cadastrados com seus links oficiais e instalação por botão no servidor. A instalação HTTP, leitura de ZIP, armazenamento e limpeza após falha foram testados com arquivos de áudio e ZIPs controlados. Não são usados arquivos falsos ou sintetizados com o nome de gravações externas.

## Arquivos, reprodução e persistência

- Catálogo estático: `sound-catalog.mjs`. Instalação busca apenas os quatro URLs oficiais cadastrados, sem aceitar URL arbitrária para download no servidor. A importação manual aceita o ZIP enviado pelo próprio mestre.
- Leitura de ZIP: `zip-audio.mjs`, usando streams de descompressão da plataforma. Verifica índice, limites, formato de áudio e CRC. Recusa caminhos perigosos, volumes, criptografia e arquivos corrompidos. Extrai OGG, MP3, WAV, FLAC e M4A; ignora documentos e prefere OGG quando há uma cópia WAV equivalente.
- Limites: ZIP de 32 MB, expansão de 64 MB, 8 MB por áudio, 600 arquivos e 64 MB de sons na campanha. A campanha mantém até 20 sessões e até quatro loops simultâneos.
- Instalação salva os arquivos no diretório da campanha ou R2 antes de publicar a nova biblioteca no SQLite/D1. Erros removem somente os arquivos recém-criados. Instalações repetidas do mesmo pacote reutilizam os áudios existentes.
- Estado: `audio.packs` registra créditos; `audio.clips` referencia os arquivos; `audio.soundboard.sessions` guarda pacotes, escolhas e favoritos. Volume, loops e versão de parada são compartilhados no estado do soundboard.
- Só o mestre pode preparar ou transmitir efeitos. A reprodução usa a linha do tempo compartilhada, com preparação de 1,2 segundo e consulta de áudio existente. Os sons da sessão e arquivos importados não dependem de hotlinks externos depois da instalação.
- Efeitos em loop são reconciliados por identificação, sem duplicar fontes a cada consulta. A parada geral cancela também reproduções que ainda aguardavam decodificação. Volumes de música e efeitos continuam separados.
- O backup completo inclui os áudios e as seleções. A importação de uma cópia limpa loops e comandos pendentes para não tocar sons inesperadamente.

## Verificação

`npm test` inclui soundboard por sessão, escolhas avulsas, favoritos, importação ZIP, rejeição de corrupção, rollback em falhas, autorização, pré-escuta privada, loops, parada, painel flutuante fora da aba Áudio e restauração de backup com os sons. `npm run build` e `./scripts/build-linux.sh` incluem os novos módulos, catálogo e estilos.
