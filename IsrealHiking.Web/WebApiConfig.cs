using System.Web.Http;
using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.Web
{
    public static class WebApiConfig
    {
        public static void Register(HttpConfiguration config, IConfigurationProvider configurationProvider)
        {
            // Web API configuration and services

            // Web API routes
            config.MapHttpAttributeRoutes();

            config.Routes.MapHttpRoute(
                name: "DefaultApi",
                routeTemplate: "api/{controller}/{id}",
                defaults: new { id = RouteParameter.Optional }
            );
        }
    }
}
