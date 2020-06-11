# TL;DR

Open Id Connect client initially targeting AWS Cognito as an Identity Provider providing the `@littleware/little-authn` node package.

## TOC

* [devtest](notes/howto/devTest.md)


# Login flow

Refer to the [documentation](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-userpools-server-contract-reference.html) for AWS Cognitoflow for an overview of the OIDC client login flow.

## Authorization code flow

The `@littleware/little-authn/commonjs/bin/oidcClient.js` module provides methods for
a service (as an OIDC client) to assist with 
the Authorization code flow, and establishing
a user session with the application.
* acquire a user token via the OIDC Authorization flow, 
issue the acquired identity token to the
authenticating user's web client as a secure cookie
* validate the identity token in a web client's cookie to authenticate user requests.  


## Implicit Flow

* https://auth.frickjack.com/login?response_type=token&client_id=WHATEVER&redirect_uri=http://localhost:3000/auth/login.html&state=STATE&scope=openid+profile+email
* http://localhost:3000/auth/login.html#access_token=frickfrackfroo&id_token=blablabla&state=STATE&token_type=Bearer&expires_in=3600
* https://cognito-idp.us-east-1.amazonaws.com/us-east-1_yanFUVDYv/.well-known/jwks.json
* https://medium.com/@robert.broeckelmann/openid-connect-authorization-code-flow-with-aws-cognito-246997abd11a
* https://cognito-idp.us-east-2.amazonaws.com/us-east-2_qTPWoNk4p/.well-known/openid-configuration

# Lambda Integration

docker run --rm -v "$PWD":/var/task lambci/lambda:nodejs10.x lambda.lambdaHandler

