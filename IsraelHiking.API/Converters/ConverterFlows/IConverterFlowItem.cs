namespace IsraelHiking.API.Converters.ConverterFlows
{
    /// <summary>
    /// List of constants that are used for GPSBabel mostly
    /// </summary>
    public static class FlowFormats
    {
        /// <summary>
        /// GeoJson
        /// </summary>
        public const string GEOJSON = "geojson";
        /// <summary>
        /// GPX
        /// </summary>
        public const string GPX = "gpx";
        /// <summary>
        /// KML
        /// </summary>
        public const string KML = "kml";
        /// <summary>
        /// Naviguide - TWL
        /// </summary>
        public const string TWL = "twl";
        /// <summary>
        /// KMZ - Zipped KML
        /// </summary>
        public const string KMZ = "kmz";
        /// <summary>
        /// GPX 1.1 alias in GPSBabel
        /// </summary>
        public const string GPX_BABEL_FORMAT = "gpx,gpxver=1.1";
        /// <summary>
        /// GPX 1.0 alias in GPSBabel
        /// </summary>
        public const string GPX_BABEL_FORMAT_VERSION_1 = "gpx,gpxver=1.0";
        /// <summary>
        /// KML alias in GPSBabel
        /// </summary>
        public const string KML_BABEL_FORMAT = "kml,points=0,deficon=\"http://maps.google.com/mapfiles/kml/pal4/icon61.png\"";
        /// <summary>
        /// Naviguide alias in GPSBabel
        /// </summary>
        public const string TWL_BABEL_FORMAT = "naviguide";
        /// <summary>
        /// CSV alias in GPSBabel
        /// </summary>
        public const string CSV_BABEL_FORMAT = "csv";
        /// <summary>
        /// Internal format for merging all routes in a single GPX track
        /// </summary>
        public const string GPX_SINGLE_TRACK = "gpx_single_track";
        /// <summary>
        /// Internal format for merging all routes in a single GPX route
        /// </summary>
        public const string GPX_ROUTE = "gpx_route";
        /// <summary>
        /// G-Zipped GPX
        /// </summary>
        public const string GPX_GZ = "gpx.gz";
        /// <summary>
        /// BZ2 compressed GPX
        /// </summary>
        public const string GPX_BZ2 = "gpx.bz2";
        /// <summary>
        /// Ozi explorer alias in GPSBabel
        /// </summary>
        public const string OZI_BABEL_FORMAT = "ozi";
        /// <summary>
        /// compegps alias in GPSBabel
        /// </summary>
        public const string COMPEGPS_BABEL_FORMAT = "compegps";
        /// <summary>
        /// jpg/jpeg alias in GPSBabel
        /// </summary>
        public const string JPG_BABEL_FORMAT = "exif";
    }

    /// <summary>
    /// Flow item is used to link between two formats
    /// </summary>
    public interface IConverterFlowItem
    {
        /// <summary>
        /// This method does the "heavy lifting" by doing the conversion
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
