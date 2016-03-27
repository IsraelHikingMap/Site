using IsraelHiking.API.Gpx.GpxTypes;
using IsraelHiking.Common;

namespace IsraelHiking.API.Converters
{
    public interface IGpxDataContainerConverter
    {
        DataContainer ToDataContainer(gpxType gpx);
        gpxType ToGpx(DataContainer container);
    }
}