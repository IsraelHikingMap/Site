#!/bin/bash
# Starts a new simulator with the app that the build_e2e lane of fastlane built and the image the tests add. It has to be a new one since
# the tests rely on where the image they add is among the images a simulator comes with.
set -e
cd "$(dirname "$0")"
DEVICE=$(xcrun simctl create mapeak-e2e "iPhone 17")
xcrun simctl boot "$DEVICE"
xcrun simctl bootstatus "$DEVICE"
for attempt in 1 2 3; do
  if xcrun simctl addmedia "$DEVICE" flows/image-with-exif.jpg; then
    break
  elif [ "$attempt" = 3 ]; then
    exit 1
  fi
  sleep 20
done
xcrun simctl install "$DEVICE" ../ios/.e2e-build/Build/Products/Release-iphonesimulator/App.app
