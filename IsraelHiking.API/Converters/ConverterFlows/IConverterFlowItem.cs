namespace IsraelHiking.API.Converters.ConverterFlows
{
    /// <summary>
    /// List of constants that are used for GPSBabel mostly
    /// </summary>
    public static class FlowFormats
    {
        public const string GEOJSON = "geojson";
        public const string GPX = "gpx";
        public const string KML = "kml";
        public const string TWL = "twl";
        public const string KMZ = "kmz";
        public const string GPX_BABEL_FORMAT = "gpx,gpxver=1.1";
        public const string GPX_BABEL_FORMAT_VERSION_1 = "gpx,gpxver=1.0";
        public const string KML_BABEL_FORMAT = "kml,points=0";
        public const string TWL_BABEL_FORMAT = "naviguide";
        public const string CSV_BABEL_FORMAT = "csv";
        public const string GPX_SINGLE_TRACK = "gpx_single_track";
        public const string GPX_ROUTE = "gpx_route";
        public const string GPX_GZ = "gpx.gz";
        public const string GPX_BZ2 = "gpx.bz2";
    }

    /// <summary>
    /// Flow item is used to link between two formats
    /// </summary>
    public interface IConverterFlowItem
    {
        /// <summary>
        /// This method does the "heavy lifting" be doing the conversion
        /// </summary>
        /// <param name="content">The file content to convert</param>
        /// <returns>Converted file content</returns>
        byte[] Transform(byte[] content);
        /// <summary>
        /// The input format
        /// </summary>
        string Input { get; }
        /// <summary>
        /// The output format
        /// </summary>
        string Output { get; }
    }
}