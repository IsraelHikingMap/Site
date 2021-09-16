using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace IsraelHiking.Web
{
    /// <inheritdoc />
    /// <summary>
    /// This class is used for dependency injection for <see cref="ISecurityTokenValidator"/>
    /// </summary>
    public class JwtBearerOptionsValidatorConfigureOptions : PostConfigureOptions<JwtBearerOptions>
    {
        public JwtBearerOptionsValidatorConfigureOptions(/*ISecurityTokenValidator securityTokenValidator*/) : base(
            JwtBearerDefaults.AuthenticationScheme,
            options =>
            {
                //options.SecurityTokenValidators.Clear();
                //options.SecurityTokenValidators.Add(securityTokenValidator);
            })
        {}
    }
}