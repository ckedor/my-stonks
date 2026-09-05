#!/usr/bin/env bash
#
# A suíte inteira, de uma vez: o que os hooks do `.pre-commit-config.yaml`
# rodavam antes de vitest e regressão visual saírem do push.
#
#     ./check.sh          # tudo, menos a regressão visual
#     ./check.sh --e2e    # tudo, incluindo a regressão visual
#     ./check.sh --back   # só o backend
#     ./check.sh --front  # só o frontend
#
# Roda tudo até o fim mesmo com falha, e resume no final. Parar no primeiro
# erro esconde os outros, e é justamente quando algo quebra que interessa ver
# o estrago inteiro de uma vez.
#
# Sai com 1 se qualquer check falhar, para dar para encadear com `&&`.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACK="$ROOT/backend"
FRONT="$ROOT/frontend"

RUN_BACK=1
RUN_FRONT=1
RUN_E2E=0

for arg in "$@"; do
  case "$arg" in
    --e2e)   RUN_E2E=1 ;;
    --back)  RUN_FRONT=0 ;;
    --front) RUN_BACK=0 ;;
    -h|--help) sed -n "2,16p" "${BASH_SOURCE[0]}" | sed 's/^# \?//'; exit 0 ;;
    *) echo "opção desconhecida: $arg" >&2; exit 2 ;;
  esac
done

bold=$'\e[1m'; red=$'\e[31m'; green=$'\e[32m'; dim=$'\e[2m'; off=$'\e[0m'

RESULTS=()
FAILED=0

run() {
  local name="$1"; shift
  printf '\n%s── %s %s%s\n' "$bold" "$name" "${dim}$*" "$off"
  local start=$SECONDS
  if "$@"; then
    RESULTS+=("$green✔$off $name ${dim}($((SECONDS - start))s)$off")
  else
    RESULTS+=("$red✘$off $name ${dim}($((SECONDS - start))s)$off")
    FAILED=1
  fi
}

if [[ $RUN_BACK == 1 ]]; then
  cd "$BACK" || exit 1
  export PATH="$BACK/.venv/bin:$PATH"
  run "ruff check"    .venv/bin/ruff check app tests
  run "ruff format"   .venv/bin/ruff format --check app tests
  run "pytest"        .venv/bin/python -m pytest -q
  # Não bloqueia no push por decisão do `.pre-commit-config.yaml`; aqui conta.
  run "lint-imports"  .venv/bin/lint-imports
fi

if [[ $RUN_FRONT == 1 ]]; then
  cd "$FRONT" || exit 1
  run "eslint"        npm run --silent lint
  run "ds-baseline"   npm run --silent lint:ds
  run "vitest"        npm run --silent test
  run "knip"          npx knip --no-progress
  run "tsc + build"   npm run --silent build
  # Fora da máquina do mantenedor a comparação sai vermelha em toda tela que
  # tenha letra, sem que nada tenha mudado: o Chromium precisa ser a build que
  # o @playwright/test do projeto pede. Por isso é opt-in.
  if [[ $RUN_E2E == 1 ]]; then
    run "regressão visual" npm run --silent e2e
  fi
fi

printf '\n%s── resumo%s\n' "$bold" "$off"
for line in "${RESULTS[@]}"; do printf '  %s\n' "$line"; done
if [[ $RUN_E2E == 0 && $RUN_FRONT == 1 ]]; then
  printf '  %s· regressão visual não rodou (--e2e)%s\n' "$dim" "$off"
fi

exit $FAILED
