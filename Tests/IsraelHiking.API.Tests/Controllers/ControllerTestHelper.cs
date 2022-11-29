using IsraelHiking.Common;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Osm;

namespace IsraelHiking.API.Tests.Controllers
{
    public static class ControllerTestHelper
    {
        public static void SetupIdentity(this ControllerBase controller, string osmUserId = "42")
        {
            var user = new ClaimsPrincipal(new ClaimsIdentity(new[] {
                new Claim(ClaimTypes.Name, osmUserId),
                new Claim(OsmAuthFactoryWrapper.CLAIM_KEY, "a;b")
            }));
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = user }
            };
        }
    }
}
