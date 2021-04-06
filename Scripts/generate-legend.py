#!/usr/bin/env python3

'''
This script generates the legend thumbnails for IHM and ilMTB styles

Usage:
    generate-legend.py [substring]

    If substring is given, only files with names containing the substring will be generated

Workflow:
1. `make refresh-styles start-tileserver-legend` in the vector tile server directory
2. `cd IsraelHiking.Web/src/content/legend` in this repository
3. Optional: `rm *.png` to clean unused legend entries
4. `../../../../Scripts/generate-legend.py`
'''

import json
import requests
import sys

from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry

session = requests.Session()
retries = Retry(total=5, backoff_factor=1, status_forcelist=[ 502, 503, 504 ])
session.mount('http://', HTTPAdapter(max_retries=retries))

with open("legend.json", "r", encoding="utf8") as read_file:
    jsonData = json.load(read_file)

styles = ["IHM", "ilMTB"]

sys.argv.append("")
# sys.stderr.write("sys.argv[1]: {}\n".format(sys.argv[1]))

for style in styles:
    for section in jsonData:
        for item in section["items"]:
            width = 50 if item["type"] == "POI" else 200
            uri = "http://0.0.0.0:8082/styles/{}/static/{:.7f},{:.7f},{:02}/{:03}x50@2x.png".format(
                    style, item["latlng"]["lng"], item["latlng"]["lat"], item["zoom"], width)
            filename = "{0}_{1}.png".format(style, item["key"])
            if sys.argv[1] in filename:
                sys.stderr.write("{}\t-> {} ".format(uri, filename))
                sys.stderr.flush()
                with open(filename, "wb") as f:
                    response = session.get(uri)
                    sys.stderr.write("{}\n".format(response.status_code))
                    f.write(response.content)

