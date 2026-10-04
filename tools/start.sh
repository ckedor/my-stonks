#!/usr/bin/env bash
# O dev server das ferramentas de desenvolvimento (porta 5180).
#
# O tools/ não tem dependências próprias: ele desenha os componentes do app,
# e precisa da MESMA cópia de React, MUI e tema que o app usa — duas cópias de
# MUI e o ThemeProvider de uma não pinta os componentes da outra. Então
# tools/node_modules é um link para frontend/node_modules, e o Vite resolve
# o link para o caminho real: app e tools enxergam os mesmos arquivos.
set -e
cd "$(dirname "$0")"
ln -sfn ../frontend/node_modules node_modules
exec node_modules/.bin/vite "$@"
