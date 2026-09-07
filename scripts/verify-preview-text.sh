#!/bin/zsh
set -eu

if (( $# < 2 )); then
  print -u2 'usage: scripts/verify-preview-text.sh <html-or-svg> <rendered-image> [...]'
  exit 2
fi

source_file="$1"
shift
script_dir="${0:A:h}"
node "$script_dir/human-text-gate.mjs" "$source_file"
CLANG_MODULE_CACHE_PATH=/private/tmp/pfg-human-text-clang-cache \
swift -module-cache-path /private/tmp/pfg-human-text-swift-cache "$script_dir/human-text-ocr.swift" "$@"
