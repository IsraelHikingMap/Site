@REM Updates the site's OSM database using http post request.
@REM Usage UpdateDB <updated osm.pbf file>

curl -X POST https://israelhiking.osm.org.il/api/update/
