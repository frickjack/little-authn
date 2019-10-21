# TL;DR

Open Id Connect client initially targeting AWS Cognito as an Identity Provider providing the `@littleware/little-authn` node package.

# Development

`gulp` manages the build and deploy process

* run build
  ```
  npx gulp compile
  ```
* watch for file changes, and build:
  ```
  npx gulp little-watch
  ```
* run local dev server
  ```
  npm start
  ```
, then http://localhost:3000/index.html has links to 
the component test pages at the bottom.

# Login flow


https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-userpools-server-contract-reference.html

## Authorization code flow

The `@littleware/little-authn/commonjs/bin/oidcClient.js` module provides methods for
a service (as an OIDC client) to assist with 
the Authorization code flow, and establishing
a user session with the application.
* acquire a user token via the OIDC Authorization flow, 
issue the acquired identity token to the
authenticating user's web client as a secure cookie
* validate the identity token in a web client's cookie to authenticate user requests


 https://auth.frickjack.com/login?client_id=3s5gm46r6khq4ko9brvdf8aq22&redirect_uri=http://localhost:3000/auth/login.html&response_type=code&state=ok

or

https://auth.frickjack.com/oauth2/authorize?client_id=3s5gm46r6khq4ko9brvdf8aq22&redirect_uri=http://localhost:3000/auth/login.html&response_type=code&state=ok&scope=email

## Implicit Flow

* https://auth.frickjack.com/login?response_type=token&client_id=WHATEVER&redirect_uri=http://localhost:3000/auth/login.html&state=STATE&scope=openid+profile+email
* http://localhost:3000/auth/login.html#access_token=frickfrackfroo&id_token=blablabla&state=STATE&token_type=Bearer&expires_in=3600
* https://cognito-idp.us-east-1.amazonaws.com/us-east-1_yanFUVDYv/.well-known/jwks.json

# Lambda Integration

docker run --rm -v "$PWD":/var/task lambci/lambda:nodejs10.x lambda.lambdaHandler
