using IsraelHiking.DataAccessInterfaces;
using log4net;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Http.ExceptionHandling;

namespace IsraelHiking.DataAccess
{
    public class Logger : ExceptionLogger, ILogger
    {
        private readonly ILog log = LogManager.GetLogger(typeof(Logger));

        public void Info(string message)
        {
            log.Info(message);
        }

        public void Debug(string message)
        {
            log.Debug(message);
        }

        public void Warn(string message)
        {
            log.Warn(message);
        }

        public void Error(string message)
        {
            log.Error(message);
        }

        public override async Task LogAsync(ExceptionLoggerContext context, CancellationToken cancellationToken)
        {
            log.Error(context.Exception.ToString());
            await base.LogAsync(context, cancellationToken);
        }

        public override void Log(ExceptionLoggerContext context)
        {
            log.Error(context.Exception.ToString());
            base.Log(context);
        }
    }
}
