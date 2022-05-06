namespace IsraelHiking.API.Services
{
    public interface IHomePageHelper
    {
        string Render(string title, string thumbnailUrl, string description, string language);
    }

}