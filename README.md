# TL;DR

Open Id Connect client initially targeting AWS Cognito as an Identity Provider.

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

## Login

* https://auth.frickjack.com/login?client_id=3s5gm46r6khq4ko9brvdf8aq22&redirect_uri=http://localhost:3000/auth/login.html&response_type=code&state=ok

or

https://auth.frickjack.com/oauth2/authorize?client_id=3s5gm46r6khq4ko9brvdf8aq22&redirect_uri=http://localhost:3000/auth/login.html&response_type=code&state=ok&scope=email