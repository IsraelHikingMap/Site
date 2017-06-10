@REM starts the elastic search server
PUSHD %~dp0
java -Delasticsearch -Des-foreground=yes -Des.path.home="./" -cp "lib/elasticsearch-2.3.5.jar;lib/*" "org.elasticsearch.bootstrap.Elasticsearch" start
POPD