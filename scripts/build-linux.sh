#!/bin/sh
set -eu
cd "$(dirname "$0")/.."

case "$(uname -s):$(uname -m)" in
  Linux:x86_64) platform=linux-x64 ;;
  Linux:aarch64) platform=linux-arm64 ;;
  *) printf 'Use Linux x86_64 ou aarch64 para empacotar.\n' >&2; exit 1 ;;
esac

node_bin=$(realpath "$(command -v node)")
node_license="$(dirname "$node_bin")/../LICENSE"
if [ ! -f "$node_license" ]; then
  node_license=${FORJA_NODE_LICENSE:-/usr/share/doc/nodejs/copyright}
fi
if [ ! -f "$node_license" ]; then
  printf 'Defina FORJA_NODE_LICENSE com o caminho da licença do Node.js usado no pacote.\n' >&2
  exit 1
fi

stage=$(mktemp -d)
output=''
trap 'rm -rf -- "$stage"; if [ -n "$output" ]; then rm -f -- "$output"; fi' EXIT
mkdir -p "$stage/bin" releases
install -m 755 "$node_bin" "$stage/bin/node"
cp "$node_license" "$stage/NODE-LICENSE"
cp DND-SRD.md player-sharing.mjs session-log.mjs item-assets.mjs loot-data.mjs loot-model.mjs request-json.mjs vision-model.mjs inventory-model.mjs soundboard-model.mjs sound-catalog.mjs sound-pack-import.mjs zip-audio.mjs campaign-backup.mjs sheet-template-model.mjs sheet-history.mjs journal-model.mjs narration-model.mjs narration-style.mjs exploration-model.mjs scene-model.mjs token-motion.mjs token-icons.mjs fog-geometry.mjs table-realtime.mjs sheet-layout.mjs gm-screen-model.mjs server.mjs api.mjs browser-session.mjs dnd.mjs music-model.mjs access.mjs model.mjs table-model.mjs media.mjs network.mjs data-directory.mjs data-backup.mjs diagnostics.mjs storage.mjs "$stage/"
cp -R public drizzle "$stage/"
tar -C "$stage" -cf "$stage/bundle.tar" bin NODE-LICENSE DND-SRD.md player-sharing.mjs session-log.mjs item-assets.mjs loot-data.mjs loot-model.mjs request-json.mjs vision-model.mjs inventory-model.mjs soundboard-model.mjs sound-catalog.mjs sound-pack-import.mjs zip-audio.mjs campaign-backup.mjs sheet-template-model.mjs sheet-history.mjs journal-model.mjs narration-model.mjs narration-style.mjs exploration-model.mjs scene-model.mjs token-motion.mjs token-icons.mjs fog-geometry.mjs table-realtime.mjs sheet-layout.mjs gm-screen-model.mjs server.mjs api.mjs browser-session.mjs dnd.mjs music-model.mjs access.mjs model.mjs table-model.mjs media.mjs network.mjs data-directory.mjs data-backup.mjs diagnostics.mjs storage.mjs public drizzle
output=$(mktemp "releases/.forja-$platform.XXXXXXXX")
cat scripts/linux-launcher.sh > "$output"
gzip -1 -c "$stage/bundle.tar" >> "$output"
chmod 755 "$output"
artifact="releases/forja-de-mesas-$platform"
mv -f -- "$output" "$artifact"
output=''
printf '%s\n' "$artifact"
