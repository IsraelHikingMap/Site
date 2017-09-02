using System.Linq;
using IsraelHiking.API.Gpx;

namespace IsraelHiking.API.Converters.ConverterFlows
{
    ///<inheritdoc />
    public class GpxToRouteGpxConverterFlow : IConverterFlowItem
    {
        ///<inheritdoc />
        public string Input => FlowFormats.GPX_BABEL_FORMAT;
        ///<inheritdoc />
        public string Output => FlowFormats.GPX_ROUTE;

        ///<inheritdoc />
        public byte[] Transform(byte[] content)
        {
            var gpx = content.ToGpx();
            var routes = (gpx.rte ?? new rteType[0]).ToList();
            routes.AddRange((gpx.trk ?? new trkType[0]).Select(t => new rteType
            {
                name = t.name,
                desc = t.desc,
                cmt = t.cmt,
                rtept = (t.trkseg ?? new trksegType[0]).SelectMany(s => s.trkpt).ToArray()
            }));
            var routeGpx = new gpxType
            {
                wpt = gpx.wpt,
                rte = routes.ToArray(),
                trk = new trkType[0],
            };
            return routeGpx.ToBytes();
        }
    }
}