using System;
using System.Linq;
using System.Text.Json.Serialization;

namespace IsraelHiking.Common
{
    public class LatLng : IEquatable<LatLng>
    {
        [JsonPropertyName("lat")]
        public double Lat { get; set; }
        [JsonPropertyName("lng")]
        public double Lng { get; set; }
        [JsonPropertyName("alt")]
        public double? Alt { get; set; }

        public bool Equals(LatLng other)
        {
            return Math.Abs(other.Lat - Lat) < double.Epsilon && Math.Abs(other.Lng - Lng) < double.Epsilon;
        }

        public override bool Equals(object obj)
        {
            if (obj is LatLng latLng)
            {
                return Equals(latLng);
            }
            return false;
        }

        public override int GetHashCode()
        {
            unchecked
            {
                return (Lat.GetHashCode() * 397) ^ Lng.GetHashCode();
            }
        }

        public LatLng() : this(0, 0) { }

        public LatLng(double latitude, double longitude, double? altitude = null)
        {
            Lat = latitude;
            Lng = longitude;
            Alt = altitude;
        }

        public LatLng(string latlngString) : this()
        {
            var split = latlngString.Split(',');
            if (split.Length != 2)
            {
                return;
            }
            Lat = double.Parse(split.First());
            Lng = double.Parse(split.Last());
        }
    }

    public class LatLngTime : LatLng
    {
        [JsonPropertyName("timestamp")]
        public DateTime? Timestamp { get; set; }

        public LatLngTime()
            : this(0, 0) { }

        public LatLngTime(double latitude, double longitude, double? altitude = null)
            : base(latitude, longitude, altitude) { }
    }
}
