using System.Linq;

namespace IsraelHiking.Common
{
    public class TokenAndSecret
    {
        public const string CLAIM_KEY = "osm_token";
        
        public string Token { get; }
        public string TokenSecret { get; }

        public TokenAndSecret(string token, string tokenSecret)
        {
            Token = token;
            TokenSecret = tokenSecret;
        }

        public override bool Equals(object obj)
        {
            var key = obj as TokenAndSecret;
            return key != null && Equals(key);
        }

        protected bool Equals(TokenAndSecret other)
        {
            return string.Equals(Token, other.Token) && string.Equals(TokenSecret, other.TokenSecret);
        }

        public override int GetHashCode()
        {
            unchecked
            {
                return ((Token?.GetHashCode() ?? 0) * 397) ^ (TokenSecret?.GetHashCode() ?? 0);
            }
        }

        public override string ToString()
        {
            return $"{Token};{TokenSecret}";
        }

        public static TokenAndSecret FromString(string tokenAndSecretString)
        {
            var split = tokenAndSecretString.Split(';');
            var token = split.First().Trim('"');
            var tokenSecret = split.Last().Trim('"');
            return new TokenAndSecret(token, tokenSecret);
        }
    }

}
