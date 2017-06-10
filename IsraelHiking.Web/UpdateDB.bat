@REM Updates the site's OSM database uing http post request.
@REM Usage UpdateDB <updated osm.pbf file>

curl -F "file=@localfile;filename=israel-and-palestine-latest.osm.pbf" localhost:8080/api/update
