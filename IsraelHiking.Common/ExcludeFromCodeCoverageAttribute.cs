using System;

namespace IsraelHiking.Common
{
    /// <summary>
    /// this class is used to mark functions and classes as excluded from code coverage 
    /// since this attribute is missing in .net core right now...
    /// </summary>
    public class ExcludeFromCodeCoverageAttribute : Attribute
    {
    }
}
