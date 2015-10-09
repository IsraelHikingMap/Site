using IsraelHiking.DataAccess;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Web.Http;

namespace IsraelHiking.API.Controllers
{
    public class ElevationController : ApiController
    {
        public ElevationController()
        {

        }
        // GET api/elevation?point=31.8239,35.0375&point=31.8213,35.0965
        public IEnumerable<double> GetElevation([FromUri]string[] point)
        {
            return point.Select(p =>
            {
                var splitted = p.Split(',');
                return ElevationDataStorage.Instance.GetElevation(double.Parse(splitted[0]), double.Parse(splitted[1]));
            });
        }
    }
}
