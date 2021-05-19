using Microsoft.AspNetCore;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Logging;
using NLog.Extensions.Logging;
using NLog.Web;
using System.IO;

namespace IsraelHiking.Web
{
    public class Program
    {
        public static void Main(string[] args)
        {
            WebHost.CreateDefaultBuilder(args)
                .ConfigureLogging((hostingContext, logging) => {
                    NLog.LogManager.LoadConfiguration("IsraelHiking.Web.nlog");
                    logging.AddNLog();
                    logging.SetMinimumLevel(LogLevel.Trace);
                })
                .UseStartup<Startup>()
                .UseContentRoot(Directory.GetCurrentDirectory())
                .UseUrls("http://0.0.0.0:5000", "https://0.0.0.0:5001")
                .Build()
                .Run();
        }
    }
}
