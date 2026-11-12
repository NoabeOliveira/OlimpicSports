#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
if [ ! -f .env ]; then
 cp .env.example .env
 echo "Edite o arquivo .env e configure ADMIN_EMAIL e ADMIN_PASSWORD; depois execute este script novamente."
 exit 1
fi
node --env-file=.env server.js
