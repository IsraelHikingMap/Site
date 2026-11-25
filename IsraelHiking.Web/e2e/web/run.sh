#!/bin/bash
# Serves the output of build:web-e2e, which uses the production server, and runs the web flows against it.
# The addresses of the map have dots in them, which are taken for a file extension without --no-ignores.
set -e
cd "$(dirname "$0")/../.."
npx sirv "${E2E_WEB_ROOT:-wwwroot}" --single index.csr.html --no-ignores --port 4173 --quiet &
SERVER=$!
trap 'kill $SERVER' EXIT
curl --silent --fail --output /dev/null --retry 30 --retry-delay 1 --retry-connrefused http://localhost:4173/index.csr.html
maestro --platform web test --headless --screen-size 1280x720 "$@" e2e/web/flows
