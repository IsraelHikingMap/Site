using System.Collections.Generic;

namespace IsraelHiking.DataAccess.GraphHopper
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
    }

    public class JsonPoints
    {
        public string type { get; set; }
        public List<List<double>> coordinates { get; set; }
    }
}