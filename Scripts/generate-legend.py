#!/usr/bin/env python3

#######################################################
# Make sure to run this script on the server and make #
# sure legend.json file is right next to this script. #
#######################################################

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

for style in styles:
    for section in jsonData:
        for item in section["items"]:
            width = 50 if item["type"] == "POI" else 200
            uri = "http://10.10.10.11:8080/styles/{}/static/{},{},{}/{}x50@2x.png".format(
                    style, item["latlng"]["lng"], item["latlng"]["lat"], item["zoom"], width)
            filename = "{0}_{1}.png".format(style, item["key"])
            sys.stderr.write("{}\t-> {} ".format(uri, filename))
            sys.stderr.flush()
            with open(filename, "wb") as f:
                response = session.get(uri)
                sys.stderr.write("{}\n".format(response.status_code))
                f.write(response.content)

