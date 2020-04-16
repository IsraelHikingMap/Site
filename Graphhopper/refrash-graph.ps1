docker rm graphhopper-rebuild
Remove-Item -Path ./data/default-gh -Recurse
docker-compose -f ./docker-compose-gh-rebuild.yml up
docker container create --name dummy -v site_ghdata:/root hello-world
cd ..
docker-compose stop graphhopper
docker cp ./Graphhopper/data/default-gh/ dummy:/root/
docker rm dummy
docker-compose start graphhopper