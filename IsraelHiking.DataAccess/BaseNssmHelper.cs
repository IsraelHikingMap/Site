using System;
using System.IO;
using System.Linq;
using System.ServiceProcess;
using System.Threading.Tasks;
using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.DataAccess
{
    public abstract class BaseNssmHelper : INssmHelper
    {
        private const string NSSM_EXE = "nssm.exe";

        protected ILogger Logger { get; }
        protected IProcessHelper ProcessHelper { get; }
        protected string WorkingDirectory { get; private set; }
        private string _nssm;

        protected abstract string RelativePath { get; }
        protected abstract string Name { get; }
        protected abstract string Description { get; }
        protected abstract string CommandLine { get; }

        protected BaseNssmHelper(ILogger logger, IProcessHelper processHelper)
        {
            Logger = logger;
            ProcessHelper = processHelper;
        }

        public Task Initialize(string serverPath)
        {
            return Task.Run(() =>
            {
                _nssm = Path.Combine(serverPath, NSSM_EXE);
                if (File.Exists(_nssm) == false)
                {
                    Logger.LogError("NSSM file is missing at: " + _nssm);
                }
                WorkingDirectory = Path.Combine(serverPath, RelativePath);
                var serviceController = GetService();
                if (serviceController != null && serviceController.Status == ServiceControllerStatus.Running)
                {
                    return;
                }
                UninstallService();
                InstallService();
            });
        }

        public void Start()
        {
            ProcessHelper.Start(_nssm, $"start {Name}", WorkingDirectory);
        }

        public void Stop()
        {
            ProcessHelper.Start(_nssm, $"stop {Name}", WorkingDirectory);
        }

        private void InstallService()
        {
            Logger.LogInformation($"Adding {Name} service to windows...");
            var installArguments = $"install {Name} {CommandLine}";
            ProcessHelper.Start(_nssm, installArguments, WorkingDirectory);
            ProcessHelper.Start(_nssm, $"set {Name} AppDirectory \"{WorkingDirectory}\"", WorkingDirectory);
            ProcessHelper.Start(_nssm, $"set {Name} Description \"{Description}\"", WorkingDirectory);
            Start();
            Task.Delay(new TimeSpan(0, 0, 0, 3)).Wait();
            var serviceController = GetService();
            if (serviceController == null || serviceController.Status != ServiceControllerStatus.Running)
            {
                Logger.LogError($"Unable to add {Name} service to windows...");
            }
            else
            {
                Logger.LogInformation($"Added {Name} service to windows...");
            }
        }

        private void UninstallService()
        {
            Logger.LogInformation($"Removeing {Name} service from windows...");
            ProcessHelper.Start(_nssm, $"stop {Name}", WorkingDirectory);
            ProcessHelper.Start(_nssm, $"remove {Name} confirm", WorkingDirectory);
            Task.Delay(new TimeSpan(0, 0, 0, 3)).Wait();
            if (GetService() != null)
            {
                Logger.LogError($"Unable to remove {Name} service to windows...");
            }
            else
            {
                Logger.LogInformation($"Removed {Name} service to windows...");
            }
        }

        private ServiceController GetService()
        {
            return ServiceController.GetServices().FirstOrDefault(s => s.DisplayName == Name.Replace("\"", string.Empty));
        }



    }
}
