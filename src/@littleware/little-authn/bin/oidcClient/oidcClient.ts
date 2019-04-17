import https = require('https');
import jsonwebtoken = require('jsonwebtoken');
import jwkToPem = require('jwk-to-pem');
import nodeFetch = require('node-fetch');

const agent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 15000,
    maxSockets: 30
  });
  

/**
 * Identity provider config necessary for executing
 * the login flows.  Usually retrieved from the idp via a .well-known
 * endpoint.
 */
export interface OauthIdpConfig {
    authorization_endpoint: string;
    issuer: string;
    jwks_uri: string;
    token_endpoint: string;
    userinfo_endpoint: string;
}

/**
 * Configuration loaded at startup
 */
export interface Config {
    // url for retrieving endpoints
    idpConfigUrl: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    idpConfig: OauthIdpConfig;
}


/**
 * AuthInfo to provide back to user in response body
 */
export interface AuthInfo {
    email: string;
    csrfToken: string;
    // issued at seconds from epoch
    iat: number;
    groups: [string]
}

/**
 * LoginResult with AuthInfo to provide to user,
 * csrfToken to set in cookie, and tokenStr to set 
 * in identityToken cookie.
 */
export interface LoginResult {
    tokenStr: string;
    authInfo: AuthInfo;
}

export interface OidcClient {
    config: Config;
    keyCache: { [key: string]: string };
    lastRefreshTime: number;

    /**
     * Refresh the cached keys from the well known end point
     */
    refreshKeyCache():Promise<void>;

    /**
     * Extract user info (login, csrfToken, etc) from the given token,
     * or set email to `anonymous` if token is invalid or expired.
     * Verifies 
     * @param tokenStr signed with key specified in header and 
     *      able to retrieve from the key cache
     */
    getAuthInfo(tokenStr:string, csrfToken:string):Promise<AuthInfo>;

    /**
     * Verify the login callback from the identity provider
     * 
     * @param code passed from identity provider via redirect
     * @return LoginResult on success, otherwise reject Promise
     */
    completeLogin(code: string, csrfToken: string): Promise<LoginResult>;
}


class SimpleOidcClient implements OidcClient {
    private _config: Config;
    get config(): Config { return this._config; }

    private _keyCache: { [key: string]: string } = {};
    get keyCache(): { [key: string]: string } { return this._keyCache; }
    
    private _lastRefreshTime: number = 0;
    get lastRefreshTime(): number { return this._lastRefreshTime; }

    constructor(config: Config) {
        this._config = config;
    }

    refreshKeyCache():Promise<void> {
        let keysUrl = this.config.idpConfig.jwks_uri;

        return nodeFetch(keysUrl).then(
            res => res.json()
        ).then(
            (info) => {
                info.keys.foreach(
                    (kinfo) => {
                        this._keyCache[kinfo.kid] = kinfo.n;
                    }
                )
            }
        );
    }

    /**
     * Little helper - gets the given key from the key cache -
     * refreshes cache if key not present and last refresh is over
     * 5 minutes ago ...
     * 
     * @param kid 
     * @return Promise<String> 
     */
    getKey(kid:string):Promise<string> {
        const key = this.keyCache[kid];
        if (key) {
            return Promise.resolve(key);
        }
        if (this.lastRefreshTime < Date.now() - 300000) {
            this.refreshKeyCache().then(
                () => {
                    const key = this.keyCache[kid];
                    if (key) {
                        return key;
                    } 
                    throw new Error(`Invalid kid`); 
                }
            );
        }
        return Promise.reject('Invalid kid');
    }

    /**
     * Verify and decode the given token
     * 
     * @param tokenStr 
     * @param csrfToken 
     * @return Promise rejected if token fails validation
     */
    getAuthInfo(tokenStr:string, csrfToken:string):Promise<AuthInfo> {
        // get the kid from the token
        return new Promise((resolve, reject) => {
            try {
                const kid:string = JSON.parse(tokenStr.split('.')[0]).kid;
                resolve(kid);
            } catch (err) {
                reject(`Failed to extract kid from token`);
            }
        }).then(
            (kid:string) => this.getKey(kid)
        ).then(
            (jwk:any) => {
                return verifyToken(tokenStr, jwk);
            }
        ).then(
            (token:any) => {
                return {
                    email: token.email,
                    csrfToken,
                    iat: token.iat,
                    groups: token['cognito:groups']
                };
            }
        );
    }

    completeLogin(code: string, csrfToken: string): Promise<LoginResult> {
        // curl -s -i -v -u "${authClientId}:${authClientSecret}" -H 'Content-Type: application/x-www-form-urlencoded' -X POST https://auth.frickjack.com/oauth2/token -d"grant_type=authorization_code&client_id=${authClientId}&code=${code}&redirect_uri=http://localhost:3000/auth/login.html"
        const urlStr:string = `${this.config.idpConfig.token_endpoint}?grant_type=authorization_code&client_id=${this.config.clientId}&code=${code}&redirect_uri=${this.config.redirectUri}`;
        const credsStr:string = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
        return nodeFetch(urlStr, {
            agent,
            method: 'POST',
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${credsStr}`
            }
        }).then(
            THIS IS NOT RIGHT ... its a JWT, not json
            resp => resp.json()
        ).then(
            (tokenInfo) => {
                const idToken = tokenInfo['id_token'];
                if (! idToken) {
                    throw new Error('Failed to retrieve token');
                }
                const authInfo:AuthInfo = {
                    email: idToken.email,
                    csrfToken,
                    // issued at seconds from epoch
                    iat: idToken.iat,
                    groups: idToken['cognito:groups']
                };
                const loginResult:LoginResult = {
                    tokenStr: JSON.stringify(idToken),
                    authInfo
                };
                return loginResult;
            }
        );
    }

}

/**
 * Fetch the idp config from the given "well known" url
 * 
 * @param configUrl 
 */
export function fetchIdpConfig(configUrl:string):Promise<OauthIdpConfig> {
    return nodeFetch(configUrl).then(res => res.json()
    ).then(
        info => info as OauthIdpConfig
    );
}


/**
 * Verify the signature on the given jwt token
 * with the given public key
 * See https://github.com/stevenalexander/node-aws-cognito-oauth2-example/blob/master/app.js
 * 
 * @param tokenStr 
 * @param jwkStr key info from .well-known/jwks.json
 * @return Promise resolves to decoded token, else
 *          rejects with error
 */
export function verifyToken(tokenStr:string, jwk):Promise<any> {
    const pem:string = jwkToPem(jwk);
    return new Promise(
        (resolve, reject) => {
            jsonwebtoken.verify(tokenStr, pem, 
                { ignoreExpiration: true },
                function(err, decoded) {
                    if(err) {
                        reject(err);
                        return;
                    }
                    resolve(decoded);
                },
            );
        }
    );
}

export function loadConfigFromFile(jsonFile:string):Promise<Config> {
    return Promise.reject();
}

export function buildClient(config:Config):OidcClient {
    return null;
}

/*
if (process.argv.length < 4) {
    console.error(`Use: node oidcClient.ts token pubicKey`);
    process.exit(1);
}

verifyToken(process.argv[2], process.argv[3]).then(
    (decoded) => {
        console.log('Decoded token: ' + decoded);
    }
).catch(
    (err) => {
        console.error('Verify failed', err);
    }
);


module.exports = {
    fetchIdpConfig,
}

*/