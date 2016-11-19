using System;
using System.Linq;

namespace IsraelHiking.Common
{
    public class LatLng : IEquatable<LatLng>
    {
        public double lat { get; set; }
        public double lng { get; set; }

        public bool Equals(LatLng other)
        {
            return Math.Abs(other.lat - lat) < double.Epsilon && Math.Abs(other.lng - lng) < double.Epsilon;
        }

        public override bool Equals(object obj)
        {
            var latLng = obj as LatLng;
            if (latLng != null)
            {
                return Equals(latLng);
            }
            return false;
        }

        public override int GetHashCode()
        {
            unchecked
            {
                return (lat.GetHashCode()*397) ^ lng.GetHashCode();
            }
        }

        public LatLng()
        {
            lat = 0;
            lng = 0;
        }

        public LatLng(double latitude, double longitude)
        {
            lat = latitude;
            lng = longitude;
        }

        public LatLng(string latlngString) : this()
        {
            var split = latlngString.Split(',');
            if (split.Length != 2)
            {
                return;
            }
            lat = double.Parse(split.First());
            lng = double.Parse(split.Last());
        }
    }
}
