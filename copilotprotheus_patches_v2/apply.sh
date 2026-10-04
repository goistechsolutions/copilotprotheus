#!/usr/bin/env bash
set -euo pipefail
R=${1:-.};H=$(cd "$(dirname "$0")"&&pwd);python3 "$H/check_patches.py" "$R";cd "$R";for p in "$H"/000*.patch;do patch -p1 < "$p";done
