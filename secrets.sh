# See https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-userpools-server-contract-reference.html
export authConfigUrl="https://cognito-idp.us-east-1.amazonaws.com/us-east-1_yanFUVDYv/.well-known/openid-configuration"
export authClientId="$(secret-tool lookup group aws service cognito domain apps.frickjack.com type client-secret)"
export authClientSecret="$(secret-tool lookup group aws service cognito domain apps.frickjack.com type client-id)"
