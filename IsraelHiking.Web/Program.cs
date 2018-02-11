﻿using System.IO;
using Microsoft.AspNetCore;
using Microsoft.AspNetCore.Hosting;

namespace IsraelHiking.Web
{
    public class Program
    {
        public static void Main(string[] args)
        {
            new WebHostBuilder()
                .UseKestrel()
                .UseContentRoot(Directory.GetCurrentDirectory())
                .UseIISIntegration()
                .UseStartup<Startup>()
                .UseUrls("http://0.0.0.0:5000")
                .Build()
                .Run();

            // .net core 2.0
            //WebHost.CreateDefaultBuilder(args)
            //    .UseStartup<Startup>()
            //    .UseContentRoot(Directory.GetCurrentDirectory())
            //    .Build()
            //    .Run();
        }
    }
}
