using IsraelHiking.Common;
using IsraelHiking.Gpx;

namespace IsraelHiking.API.Gpx
{
    public interface IGpxDataContainerConverter
    {
        DataContainer ToDataContainer(gpxType gpx);
        gpxType ToGpx(DataContainer container);
    }
}