using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace IsraelHiking.DataAccess.JsonResponse
{
    public class JsonGraphHopperResponse
    {
        //public JsonHints hints { get; set; }
        public List<JsonPath> paths { get; set; }
    }

    public class JsonHints
    {
        //{\"visited_nodes.average\":\"62.0\",\"visited_nodes.sum\":\"62\"},
    }

    public class JsonPath
    {
        public double distance { get; set; }
        public List<double> bbox { get; set; }
        public double weight { get; set; }
        public long time { get; set; }
        public bool points_encoded { get; set; }
        public JsonPoints points { get; set; }
    }

    public class JsonPoints
    {
        public string type { get; set; }
        public List<List<double>> coordinates { get; set; }
    }
}