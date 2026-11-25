#!/bin/bash
# Starts the app once and waits for the emulator to settle: right after it boots, Android is still busy updating the
# Google services, which makes it slow and takes down apps that are running.
adb shell settings put global hide_error_dialogs 1
timeout 120 adb shell am wait-for-broadcast-idle > /dev/null
adb shell monkey -p com.mapeak -c android.intent.category.LAUNCHER 1 > /dev/null
sleep 45
adb shell am force-stop com.mapeak
for attempt in {1..18}; do
  load=$(adb shell cat /proc/loadavg | cut -d " " -f 1)
  echo "The load of the emulator is $load"
  if awk "BEGIN { exit !($load < 3) }"; then
    break
  fi
  sleep 10
done
exit 0
