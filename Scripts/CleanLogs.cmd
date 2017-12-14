forfiles -p "C:\inetpub\logs\LogFiles\W3SVC3" -s -m *.* -d -60 -c "cmd /c del @path"
forfiles -p "C:\inetpub\logs\LogFiles\W3SVC3" -s -m *.log -d -3 -c "cmd /c 7z.exe a @path.zip @path && del @path"
