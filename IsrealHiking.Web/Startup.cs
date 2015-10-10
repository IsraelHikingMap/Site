using Microsoft.Owin;
using Owin;
using System.Net.Http.Headers;
using System.Web.Http;
using IsraelHiking.API;
using IsraelHiking.DataAccess;
using System.Web.Http.ExceptionHandling;
using Microsoft.Owin.Cors;

[assembly: OwinStartup(typeof(IsraelHiking.Web.Startup))]
[assembly: log4net.Config.XmlConfigurator(Watch = true)]

namespace IsraelHiking.Web
{
    public class Startup
    {
        public void Configuration(IAppBuilder app)
        {
            var logger = new Logger();
            logger.Debug("Starting Israel Hiking Server.");
            //app.UseCors(CorsOptions.AllowAll);
            var config = new HttpConfiguration();
            WebApiConfig.Register(config);

            config.Formatters.JsonFormatter.SupportedMediaTypes.Add(new MediaTypeHeaderValue("text/html"));
            config.Formatters.JsonFormatter.SerializerSettings.ReferenceLoopHandling = Newtonsoft.Json.ReferenceLoopHandling.Ignore;
            config.Formatters.JsonFormatter.SerializerSettings.PreserveReferencesHandling = Newtonsoft.Json.PreserveReferencesHandling.None;
            config.Services.Add(typeof(IExceptionLogger), logger);

            app.UseWebApi(config);
            

            logger.Debug("Initializing Elevation data.");
            ElevationDataStorage.Instance.Initialize().ContinueWith((task) => logger.Debug("Finished loading elevation data from files."));
            logger.Debug("Israel Hiking Server is up and running.");
        }
    }
}