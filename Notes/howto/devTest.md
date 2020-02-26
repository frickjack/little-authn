# TL;DR

How to compile the code, run unit tests, and a local test server.

## Build Rules

[gulp](https://gulpjs.com/) manages the build and deploy process

* `npm run build`
is equivalent to:
  ```
  npx gulp compile
  ```
* `npm run watch`
watches for file changes, and builds - equivalent to:
  ```
  npx gulp little-watch
  ```
* `env LITTLE_CONFIG='{"value": "/path/to/config/file" }' npm start`
runs a local dev server -
http://localhost:3000/index.html has links to the component test pages at the bottom.

## Configuration

The OIDC client consumes a json configuration that specifies the client id, client secret, and https://idp/.well-known/openid-configuration endpoint.  For example:

```
{
    "note": "this sample config intentionally does not contain sensitive information",
    "idpConfigUrl": "https://accounts.google.com/.well-known/openid-configuration",
    "clientId": "XXXXXX",
    "clientSecret": "XXXXX",
    "redirectUri": "http://localhost:3000/auth/login.html"
}
```

The client can currently load the configuration from a file or from the AWS secrets manager.  An operator specifies the configuration source in the `LITTLE_CONFIG` environment variable.  If no configuration is specified, then the client attempts to apply this default load rule:
```
{
    "type": "file",
    "ttlSecs": 300,
    "value": "~/.local/etc/littleware/authn/config.json"
}
```

The client overlays the LOAD_CONFIG environment variable, so this launch script (which starts a local expressjs server for testing) loads configuration from a temporary file generated from a secret stored in the gnome keychain:
```
SECRET_FILE=$(mktemp "$XDG_RUNTIME_DIR/secret.json_XXXXXX")
secret-tool lookup group littleware path littleware/cell0/cognito > $SECRET_FILE
export LITTLE_AUTHN_CONFIG="{ \"value\": \"$SECRET_FILE\" }"
npm start
```

This launch script loads configuration from an AWS secret:
```
export AWS_PROFILE=AUTHN
export LITTLE_CONFIG='{ "type": "secret", "value": "cell0/cognito" }'
little npm start
```

## Key Ring

Save secrets for your local devtest environment
to the linux key ring with the `secret-tool` CLI.
For example - to save then retrieve the OIDC client `secret.json` described above:

```
secret-tool store --label littleware/cell0/cognito group littleware path littleware/cell0/cognito < /run/user/1000/secret.json 

secret-tool search --all group littleware
secret-tool lookup group littleware path littleware/cell0/cognito
```

## Self Signed Certificate for local testing

```
openssl genrsa -out localhost.key 2048
openssl req -new -x509 -key localhost.key -out localhost.cert -days 3650 -subj /CN=localhost

secret-tool store --label littleware/certs/localhost/key group littleware path littleware/certs/localhost/key < localhost.key 
secret-tool store --label littleware/certs/localhost/cert group littleware path littleware/certs/localhost/cert < localhost.cert
```

Set the `LITTLE_LOCALHOST` environment variable to configure the test server to load the certificate, and setup a TLS endpoint at https://localhost:3443/

```
export LITTLE_LOCALHOST="${XDG_RUNTIME_DIR}/localhost"
mkdir -p "$LITTLE_LOCALHOST"
secret-tool lookup group littleware path littleware/certs/localhost/key > "$LITTLE_LOCALHOST/localhost.key"
secret-tool lookup group littleware path littleware/certs/localhost/cert > "$LITTLE_LOCALHOST/localhost.cert"
```

## CICD

The `buildspec.yml` file defines a [codebuild](https://aws.amazon.com/codebuild/) pipeline that builds and tests code committed to the github repository.

## Testing Cognito

Initiate an `authorization_code` authentication flow via Cognito's [Login](https://docs.aws.amazon.com/cognito/latest/developerguide/login-endpoint.html) endpoint - ex:

```
CLIENT_ID="$(jq -r .clientId < $SECRET_FILE)"
echo "https://auth.frickjack.com/login?client_id=${CLIENT_ID}&redirect_uri=https%3A%2F%2Flocalhost%3A3043%2Fauthn%2FloginCallback&response_type=code&state=ok" | xclip -select clipboard
# paste url into browser
```

Use the returned `code` to retrieve refresh and identity tokens via Cognito's [Token](https://docs.aws.amazon.com/cognito/latest/developerguide/token-endpoint.html) endpoint:

```
curl -s -i -v -u "${authClientId}:${authClientSecret}" -H 'Content-Type: application/x-www-form-urlencoded' -X POST https://auth.frickjack.com/oauth2/token -d"grant_type=authorization_code&client_id=${authClientId}&code=${code}&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauthn%2FloginCallback"
```
