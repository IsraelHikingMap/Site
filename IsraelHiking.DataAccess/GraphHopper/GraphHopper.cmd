@REM starts the graphhopper server
PUSHD %~dp0
java -cp "*;web\*" com.graphhopper.http.GHServer config=israel-hiking-config.properties
POPD