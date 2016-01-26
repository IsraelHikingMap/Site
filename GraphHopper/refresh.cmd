@REM Refresh the Graphhopper graph database

@REM 1. Update the OSM pbf, if needed, or exit
@REM 2. Remove old databases, if exists
@REM 3. Build the new graph in a temporary directory
@REM 4. Kill the server
@REM 5. Rename the previous database directory
@REM 6. Rename the temporary database directory to expected location
@REM 7. Start the server
@REM 8. Remove the old database

@REM Up-to-date Graphhopper jar files were downloaded from 
@REM https://oss.sonatype.org/content/groups/public/com/graphhopper/
@REM 
@REM For example:
@REM graphhopper-0.6-20151225.190103-71.jar
@REM graphhopper-tools-0.6-20151225.190113-71.jar
@REM graphhopper-tools-lgpl-0.6-20151225.190033-26.jar
@REM graphhopper-web-0.6-20151225.190123-71.jar
@REM 
@REM graphhopper-0.6-dep.jar contains all the needed dependencies
@REM


@REM 1. Update the OSM pbf, if needed, or exit
SET PBF_DIR=c:\Users\osmhike\Documents\GitHub\IsraelHiking\Map\Cache
SET PBF_FILE=israel-and-palestine-latest.osm.pbf
FC %PBF_DIR%\%PBF_FILE% %PBF_FILE% 1>NUL:

IF ERRORLEVEL 1 (
  @REM New PBF file exists

  COPY %PBF_DIR%\%PBF_FILE% %PBF_FILE%

  @REM 2. Remove old databases, if exists
  @ECHO %TIME%
  IF EXIST israel-and-palestine-latest.osm-gh-old\ (
    RMDIR /S/Q israel-and-palestine-latest.osm-gh-old
  )
  IF EXIST israel-and-palestine-latest.osm-gh-new\ (
    RMDIR /S/Q israel-and-palestine-latest.osm-gh-new
  )

  @REM 3. Build the new graph in a temporary directory
  @ECHO %TIME%
  java -cp "*" com.graphhopper.tools.Import config=config-example.properties graph.location=israel-and-palestine-latest.osm-gh osmreader.osm=%PBF_FILE% graph.location=israel-and-palestine-latest.osm-gh-new

  IF ERRORLEVEL 1 (
    GOTO :EOF
  )
)

@REM 4. Kill the server
@ECHO %TIME%
wmic PROCESS where "name like '%%java%%' and Commandline like '%%graphhopper%%'" call terminate

IF EXIST israel-and-palestine-latest.osm-gh-new\ (

  @REM 5. Rename the previous database directory
  @ECHO %TIME%
  IF EXIST israel-and-palestine-latest.osm-gh\ (
    RENAME israel-and-palestine-latest.osm-gh israel-and-palestine-latest.osm-gh-old
  )

  @REM 6. Rename the temporary database directory to expected location
  RENAME israel-and-palestine-latest.osm-gh-new israel-and-palestine-latest.osm-gh
)

@REM 7. Start the server
@ECHO %TIME%
START javaw -cp "*;web\*" com.graphhopper.http.GHServer config=config-example.properties graph.location=israel-and-palestine-latest.osm-gh osmreader.osm=%PBF_FILE% jetty.port=8989

@REM 8. Remove the old database, if exists
@ECHO %TIME%
IF EXIST israel-and-palestine-latest.osm-gh-old\ (
  RMDIR /S/Q israel-and-palestine-latest.osm-gh-old
)
