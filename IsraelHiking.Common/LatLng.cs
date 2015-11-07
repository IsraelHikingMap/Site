using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace IsraelHiking.Common
{
    public class LatLng : IEquatable<LatLng>
    {
        public double Lat { get; set; }
        public double Lng { get; set; }

        public bool Equals(LatLng other)
        {
            return other.Lat == Lat && other.Lng == Lng;
        }

        public override int GetHashCode()
        {
            return Lat.GetHashCode() ^ Lng.GetHashCode();
        }

        public override bool Equals(object obj)
        {
            var other = obj as LatLng;
            if (other == null)
            {
                return false;
            }
            return Equals(other);
        }
    }
}
