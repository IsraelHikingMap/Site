using System.Collections.Generic;

namespace IsraelHiking.DataAccess
{
    public class JsonGraphHopperResponse
    {
        public List<JsonPath> paths { get; set; }
    }

    public class JsonPath
    {
        public double distance { get; set; }
        public List<double> bbox { get; set; }
        public double weight { get; set; }
        public long time { get; set; }
        public bool points_encoded { get; set; }
        public JsonPoints points { get; set; }
        public JsonDetails details { get; set; }
    }

    public class JsonPoints
    {
        public string type { get; set; }
        public List<List<double>> coordinates { get; set; }
    }

    public class JsonDetails
    {
        public List<List<string>> road_class { get; set; }
        public List<List<string>> track_type { get; set; }
    }
}