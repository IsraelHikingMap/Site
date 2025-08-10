using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using IsraelHiking.Common.Extensions;
using Microsoft.Extensions.Options;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;

namespace IsraelHiking.API.Tests.Services.Poi;

public abstract class BasePointsOfInterestAdapterTestsHelper
{
    protected IDataContainerConverterService _dataContainerConverterService;
    protected IOptions<ConfigurationData> _options;

    protected void InitializeSubstitutes()
    {
        _dataContainerConverterService = Substitute.For<IDataContainerConverterService>();
        _options = Substitute.For<IOptions<ConfigurationData>>();
        _options.Value.Returns(new ConfigurationData());
    }

    protected Feature GetValidFeature(string someId, string source)
    {
        var feature = new Feature
        {
            Geometry = new LineString([
                new CoordinateZ(0, 0, double.NaN),
                new CoordinateZ(1, 1, double.NaN)
            ]),
            Attributes = new AttributesTable
            {
                {FeatureAttributes.POI_CATEGORY, FeatureAttributes.POI_CATEGORY},
                {FeatureAttributes.NAME, FeatureAttributes.NAME},
                {FeatureAttributes.ID, someId},
                {FeatureAttributes.POI_SOURCE, source},
                {FeatureAttributes.POI_ICON, FeatureAttributes.POI_ICON},
                {FeatureAttributes.POI_ICON_COLOR, FeatureAttributes.POI_ICON_COLOR},
                {FeatureAttributes.POI_ALT, 11.1},
            }
        };
        feature.SetLocation(new Coordinate(2.2, 1.1));
        feature.SetId();
        return feature;
    }
}