using System.Collections.Generic;

namespace IsraelHiking.Common
{
    public class Rater
    {
        public string Id { get; set; }
        public int Value { get; set; }
    }

    public class Rating
    {
        public string Id { get; set; }
        public string Source { get; set; }
        public List<Rater> Raters { get; set; }
    }
}
