using System;

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
    }
}
