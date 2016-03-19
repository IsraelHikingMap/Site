using System;
using System.Collections.Generic;
using System.Linq;
using System.Web.Http;
using IsraelHiking.API.Controllers;

namespace IsraelHiking.Web
{
    public static class WebApiConfig
    {
        public static void Register(HttpConfiguration config)
        {
            // Web API configuration and services

            // Web API routes
            config.MapHttpAttributeRoutes();

            config.Routes.MapHttpRoute(
                name: "DefaultApi",
                routeTemplate: "api/{controller}/{id}",
                defaults: new { id = RouteParameter.Optional }
            );

            foreach (var folder in FileExplorerController.ListingDictionary.Keys)
            {
                config.Routes.MapHttpRoute(
                name: folder,
                routeTemplate: folder + "/{*path}",
                defaults: new { controller = "FileExplorer" });
            }
        }
    }
}
