namespace IsraelHiking.API.Converters.ConverterFlows
{
    public static class FlowFormats
    {
        public const string GEOJSON = "geojson";
        public const string GPX = "gpx";
        public const string KMZ = "kmz";
        public const string GPX_BABEL_FORMAT = "gpx,gpxver=1.1";
        public const string GPX_BABEL_FORMAT_VERSION_1 = "gpx,gpxver=1.0";
        public const string KML_BABEL_FORMAT = "kml,points=0";
        public const string TWL_BABEL_FORMAT = "naviguide";
        public const string CSV_BABEL_FORMAT = "csv";
        public const string GPX_SINGLE_TRACK = "gpx_single_track";
        public const string GPX_GZ = "gpx.gz";
    }

    public interface IConverterFlowItem
    {
        byte[] Transform(byte[] content);
        string Input { get; }
        string Output { get; }
    }
}