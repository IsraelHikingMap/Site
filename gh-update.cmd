#!/bin/bash

docker-compose run --rm --entrypoint /bin/bash graphhopper -c "./graphhopper.sh import asia_israel-and-palestine.pbf -c /data/gh-config.yml -fd -o /data/new-gh/ && rm -rf /data/default-gh/ && mv /data/new-gh /data/default-gh"
docker-compose restart graphhopper