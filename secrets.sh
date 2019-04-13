# See https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-userpools-server-contract-reference.html
export authConfigUrl="https://cognito-idp.us-east-1.amazonaws.com/us-east-1_yanFUVDYv/.well-known/openid-configuration"
export authClientId="$(secret-tool lookup group aws service cognito domain apps.frickjack.com type client-id)"
export authClientSecret="$(secret-tool lookup group aws service cognito domain apps.frickjack.com type client-secret)"

authToken() {
    local code
    code="$1"
    curl -s -i -v -u "${authClientId}:${authClientSecret}" -H 'Content-Type: application/x-www-form-urlencoded' -X POST https://auth.frickjack.com/oauth2/token -d"grant_type=authorization_code&client_id=${authClientId}&code=${code}&redirect_uri=http://localhost:3000/auth/login.html"
}