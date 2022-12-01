#!/usr/bin/env bash

usage() {
  echo "$(basename $0): Update cloned sprites from the VectorMap repository"
  echo
  echo "Usage:"
  echo "  $(basename $0) [--help]"
  echo
  echo "Parameters:"
  echo "  --help  Print this message"
}

if [ $# -gt 0 ]; then
  usage
  exit 1
fi

set -x
cd $(dirname $0)
rm -fr VectorMap
git clone --depth 1 https://github.com/IsraelHikingMap/VectorMap.git
cp -up VectorMap/Icons/publish/sprite* ../IsraelHiking.Web/src/content/sprite
rm -fr VectorMap
cd ..
git add --verbose -- IsraelHiking.Web/src/content/sprite
