#!/bin/bash

# 1. Run the container, import graphhopper data to a temporay directory (new-gh)
docker-compose run --rm -e "JAVA_OPTS=-Xmx2g -Xms2g" graphhopper --import --url https://download.geofabrik.de/asia/israel-and-palestine-latest.osm.pbf -o /data/new-gh/
# 2. Delete the default cache (default-gh) and move the temporary cache to the default location.
docker-compose run --rm --entrypoint /bin/bash graphhopper -c "rm -rf /data/default-gh/ ; mv /data/new-gh /data/default-gh"
# 4. Restart the container to make it use the updated default cache.
docker-compose restart graphhopper
# 5. In case of docker file changes, make sure to use the latest images, etc...
docker-compose up -d graphhopper
