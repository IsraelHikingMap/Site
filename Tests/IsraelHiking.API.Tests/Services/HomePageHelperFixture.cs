using IsraelHiking.API.Services;
using NSubstitute;

namespace IsraelHiking.API.Tests.Services
{
    public class HomePageHelperFixture
    {
        protected IHomePageHelper _homePageHelper;
        protected const string output = "OUT";

        protected void setUpHomePageHelper()
        {
            _homePageHelper = Substitute.For<IHomePageHelper>();
            _homePageHelper.Render(default, default, default, default).ReturnsForAnyArgs(output);
        }
    }
}