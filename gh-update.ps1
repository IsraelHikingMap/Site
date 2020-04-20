#!/bin/bash

# 1. It run the container, imports graphhopper data to a temporay directory (new-gh)
docker-compose run --rm --entrypoint /bin/bash graphhopper -c "./graphhopper.sh import asia_israel-and-palestine.pbf -c /data/gh-config.yml -fd -o /data/new-gh/"
# 2. Deleted the default cache (default-gh)
docker-compose run --rm --entrypoint /bin/bash graphhopper -c "rm -rf /data/default-gh/"
# 3. Moves the temporary cache to the default location.
docker-compose run --rm --entrypoint /bin/bash graphhopper -c "mv /data/new-gh /data/default-gh"
# 4. Restart the container will make it use the updated default cache.
docker-compose restart graphhopper