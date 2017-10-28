using System;
using System.Linq;
using Newtonsoft.Json;

namespace IsraelHiking.Common
{
    public class LatLng : IEquatable<LatLng>
    {
        [JsonProperty("lat")]
        public double Lat { get; set; }
        [JsonProperty("lng")]
        public double Lng { get; set; }
        [JsonProperty("alt")]
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
                return (Lat.GetHashCode()*397) ^ Lng.GetHashCode();
            }
        }

        public LatLng() : this(0,0) { }

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
}
