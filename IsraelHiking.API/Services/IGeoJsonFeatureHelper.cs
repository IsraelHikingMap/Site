using NetTopologySuite.Features;

namespace IsraelHiking.API.Services
{
    public interface IGeoJsonFeatureHelper
    {
        PropertiesData FindPropertiesData(Feature feature);
    }
}