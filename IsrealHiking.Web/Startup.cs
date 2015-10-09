using Microsoft.Owin;
using Owin;
using System.Net.Http.Headers;
using System.Web.Http;
using IsraelHiking.API;

[assembly: OwinStartup(typeof(IsraelHiking.Web.Startup))]
//[assembly: log4net.Config.XmlConfigurator(Watch = true)]

namespace IsraelHiking.Web
{
    public class Startup
    {
        public void Configuration(IAppBuilder app)
        {
            var config = new HttpConfiguration();
            WebApiConfig.Register(config);

            config.Formatters.JsonFormatter.SupportedMediaTypes.Add(new MediaTypeHeaderValue("text/html"));
            config.Formatters.JsonFormatter.SerializerSettings.ReferenceLoopHandling = Newtonsoft.Json.ReferenceLoopHandling.Ignore;
            config.Formatters.JsonFormatter.SerializerSettings.PreserveReferencesHandling = Newtonsoft.Json.PreserveReferencesHandling.None;

            app.UseWebApi(config);
        }
    }
}