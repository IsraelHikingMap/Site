@REM Updates the site's OSM database uing http post request.
@REM Usage UpdateDB <updated osm.pbf file>

curl -F "file=@%1;filename=israel-and-palestine-latest.osm.pbf" http://israelhiking.osm.org.il/api/update/
