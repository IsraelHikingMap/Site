@REM starts the graphhopper server
PUSHD %~dp0
@REM For GC debug with GCViewer https://github.com/chewiebug/gcviewer/wiki
@REM SET GC_DEBUG=-Xloggc:graphhopper.loggc -XX:+PrintGCDetails -XX:+PrintGCDateStamps

java -Xmx2048m %GC_DEBUG% -cp "*;web\*" com.graphhopper.http.GHServer config=israel-hiking-config.properties
POPD
