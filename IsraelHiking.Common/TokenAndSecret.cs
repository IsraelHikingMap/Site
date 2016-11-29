namespace IsraelHiking.Common
{
    public class TokenAndSecret
    {
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
    }

}
