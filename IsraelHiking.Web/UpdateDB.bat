@REM Updates the site's OSM database uing http post request.
@REM Usage UpdateDB <updated osm.pbf file>

curl -k -F "file=@%1;filename=israel-and-palestine-latest.osm.pbf" https://israelhiking.osm.org.il/api/update/
