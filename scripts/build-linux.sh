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
modules=$("$node_bin" -e "import('./manifest.mjs').then(m=>process.stdout.write(m.linuxBundleModules.join(' ')))")
# shellcheck disable=SC2086
cp DND-SRD.md $modules "$stage/"
cp -R public drizzle "$stage/"
# shellcheck disable=SC2086
tar -C "$stage" -cf "$stage/bundle.tar" bin NODE-LICENSE DND-SRD.md $modules public drizzle
output=$(mktemp "releases/.forja-$platform.XXXXXXXX")
cat scripts/linux-launcher.sh > "$output"
gzip -1 -c "$stage/bundle.tar" >> "$output"
chmod 755 "$output"
artifact="releases/forja-de-mesas-$platform"
mv -f -- "$output" "$artifact"
output=''
printf '%s\n' "$artifact"
