#!/bin/sh
set -eu

case "${1-}" in
  --help|-h)
    cat <<'HELP'
Forja de Mesas — servidor Linux
Uso: ./forja-de-mesas-linux-* [--lan|--local|--check|--diagnose]

Sem opções, aceita conexões na rede local pela porta 3000.
  --lan    Aceita conexões na rede local (padrão).
  --local  Aceita conexões somente neste computador.
  --check  Verifica o runtime, o banco e os arquivos do aplicativo.
  --diagnose  Testa o servidor já aberto pelos endereços do PC.
PORT, HOST e FORJA_DATA_DIR podem ser definidos no ambiente.
HELP
    exit 0
    ;;
  --lan) HOST=0.0.0.0; export HOST; shift ;;
  --local) HOST=127.0.0.1; export HOST; shift ;;
  --check|--diagnose|'') ;;
  *) printf 'Opção desconhecida. Use --help.\n' >&2; exit 2 ;;
esac
if [ "$#" -gt 1 ] || { [ "$#" -eq 1 ] && [ "$1" != "--check" ] && [ "$1" != "--diagnose" ]; }; then
  printf 'Opções inválidas. Use --help.\n' >&2
  exit 2
fi

umask 077
runtime=$(mktemp -d "${TMPDIR:-/tmp}/forja.XXXXXXXX")
cleanup() { rm -rf -- "$runtime"; }
trap cleanup EXIT
stop() { if [ -n "${server_pid:-}" ]; then kill -TERM "$server_pid" 2>/dev/null || true; fi; }
trap stop INT TERM
payload=$(LC_ALL=C awk '/^__FORJA_ARCHIVE_BELOW__$/ {print NR+1;exit}' "$0")
tail -n +"$payload" "$0" | tar -xzf - -C "$runtime"

if [ "${1-}" = "--check" ]; then
  export FORJA_DATA_DIR="$runtime/check-data"
  "$runtime/bin/node" "$runtime/server.mjs" --check
  exit 0
fi

if [ "${1-}" = "--diagnose" ]; then
  "$runtime/bin/node" "$runtime/server.mjs" --diagnose
  exit $?
fi

"$runtime/bin/node" "$runtime/server.mjs" &
server_pid=$!
result=0
wait "$server_pid" || result=$?
if kill -0 "$server_pid" 2>/dev/null; then wait "$server_pid" || result=$?; fi
exit "$result"
__FORJA_ARCHIVE_BELOW__
