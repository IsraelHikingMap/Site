@REM starts the elastic search server
PUSHD %~dp0
@REM For GC debug with GCViewer https://github.com/chewiebug/gcviewer/wiki
@REM SET GC_DEBUG=-Xloggc:elasticsearch.loggc -XX:+PrintGCDetails -XX:+PrintGCDateStamps

java -Xmx1024m %GC_DEBUG% -Delasticsearch -Des-foreground=yes -Des.path.home="./" -cp "lib/elasticsearch-2.3.5.jar;lib/*" "org.elasticsearch.bootstrap.Elasticsearch" start
POPD
