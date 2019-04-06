import nodeFetch = require('node-fetch');
import jsonwebtoken = require('jsonwebtoken');

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

export interface Config {
    // url for retrieving endpoints
    idpConfigUrl: string;
    clientId: string;
    clientSecret: string;
    idpConfig: OauthIdpConfig;
}

/**
 * AuthInfo to provide back to user in response body
 */
export interface AuthInfo {
    email: string;
    csrfToken: string;
    // expiration seconds from epoch
    expiration: number;
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
    completeLogin(code: string): Promise<LoginResult>;
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

    getAuthInfo(tokenStr:string, csrfToken:string):Promise<AuthInfo> {
        return Promise.reject();
    }

    completeLogin(code: string): Promise<LoginResult> {
        return Promise.reject();
    }

}

export function fetchIdpConfig(configUrl:string):Promise<OauthIdpConfig> {
    return nodeFetch(configUrl).then(res => res.json()
    ).then(
        info => info as OauthIdpConfig
    );
}



function verifyToken(tokenStr, publicKey) {
    return new Promise(
        (resolve, reject) => {
            jsonwebtoken.verify(tokenStr, new Buffer(publicKey, 'base64'), 
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