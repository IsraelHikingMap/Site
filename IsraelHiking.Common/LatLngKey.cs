using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace IsraelHiking.Common
{
    public class LatLngKey : IEquatable<LatLngKey>
    {
        public double Lat { get; set; }
        public double Lng { get; set; }

        public bool Equals(LatLngKey other)
        {
            return other.Lat == Lat && other.Lng == Lng;
        }

        public override int GetHashCode()
        {
            return Lat.GetHashCode() ^ Lng.GetHashCode();
        }

        public override bool Equals(object obj)
        {
            var other = obj as LatLngKey;
            if (other == null)
            {
                return false;
            }
            return Equals(other);
        }
    }
}
