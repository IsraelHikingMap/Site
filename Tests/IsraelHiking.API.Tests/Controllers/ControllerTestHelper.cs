using IsraelHiking.API.Services;
using IsraelHiking.Common;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace IsraelHiking.API.Tests.Controllers
{
    public static class ControllerTestHelper
    {
        public static void SetupIdentity(this ControllerBase controller, LruCache<string, TokenAndSecret> cache = null, string osmUserId = "42")
        {
            var user = new ClaimsPrincipal(new ClaimsIdentity(new[] {
                new Claim(ClaimTypes.Name, osmUserId)
            }));
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = user }
            };
            if (cache != null)
            {
                cache.Add(osmUserId, new TokenAndSecret("", ""));
            }
        }
    }
}
