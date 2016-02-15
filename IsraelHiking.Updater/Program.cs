using System;
using System.IO;
using IsraelHiking.DataAccess;
using IsraelHiking.DataAccess.GraphHopper;

namespace IsraelHiking.Updater
{
    class Program
    {
        static void Main(string[] args)
        {
            var logger = new ConsoleLogger();
            var helper = new GraphHopperHelper(logger, new ProcessHelper(logger));
            var directory = Directory.GetCurrentDirectory();
            logger.Info("Initializing Graph Hopper service at: " + directory);
            try
            {
                helper.Initialize(directory).Wait();
                helper.UpdateData().Wait();
                logger.Info("Finished updating Graph Hopper data");
            }
            catch (Exception ex)
            {
                logger.Error("Failed updating data with exception: " + ex);
            }
            
            Console.ReadLine();
        }
    }
}
