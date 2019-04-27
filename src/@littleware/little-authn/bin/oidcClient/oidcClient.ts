import crypto = require('crypto');
import jsonwebtoken = require('jsonwebtoken');
import jwkToPem = require('jwk-to-pem');
import { NetHelper } from './netHelper';
import { ConfigHelper, JsonFileHelper } from './configHelper';
import { squish } from '@littleware/little-elements/commonjs/common/mutexHelper';

const homedir = require('os').homedir();

/**
 * https://tools.ietf.org/html/rfc7517
 */
export interface JWK {
    kid: string;
    kty: string;
    use: string;
    alg: string;
}

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
    keyCache: { [key: string]: JWK };
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
     * Little helper - gets the given key from the key cache -
     * refreshes cache if key not present and last refresh is over
     * 5 minutes ago ...
     * 
     * @param kid 
     * @return Promise<JWK> 
     */
    getKey(kid:string):Promise<JWK>;

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

    private _keyCache: { [key: string]: JWK } = {};
    get keyCache(): { [key: string]: JWK } { return this._keyCache; }
    
    private _lastRefreshTime: number = 0;
    get lastRefreshTime(): number { return this._lastRefreshTime; }

    private _netHelper:NetHelper = null;

    constructor(config:Config, netHelper:NetHelper) {
        this._config = config;
        this._netHelper = netHelper;
    }

    private _squishKeyRefresh = squish(
        () => {
            let keysUrl = this.config.idpConfig.jwks_uri;

            return this._netHelper.fetchJson(keysUrl).then(
                (info) => {
                    info.keys.forEach(
                        (kinfo:JWK) => {
                            this._keyCache[kinfo.kid] = kinfo;
                        }
                    );
                    this._lastRefreshTime = Date.now();
                }
            );
        }
    );
    
    refreshKeyCache():Promise<void> {
        return this._squishKeyRefresh();
    }

    getKey(kid:string):Promise<JWK> {
        const key = this.keyCache[kid];
        if (key) {
            return Promise.resolve(key);
        }
        if (this.lastRefreshTime < Date.now() - 300000) {
            return this.refreshKeyCache().then(
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
                const kid:string = JSON.parse(new Buffer(tokenStr.split('.')[0], 'base64').toString('utf8')).kid;
                resolve(kid);
            } catch (err) {
                reject(`Failed to extract kid from token: ${err}`);
            }
        }).then(
            (kid:string) => this.getKey(kid)
        ).then(
            (jwk:JWK) => {
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
        return this._netHelper.fetchJson(urlStr, {
            method: 'POST',
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${credsStr}`
            }
        }).then(
            (tokenInfo) => {
                const jwt = tokenInfo['id_token'];
                if (! jwt) {
                    throw new Error('Failed to retrieve token');
                }
                const parts = jwt.split('.').map((str,idx) => idx < 2 ? atob(str.replace('-', '+').replace('_', '/')) : str);
                const idToken = parts[1];
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
export function fetchIdpConfig(configUrl:string, netHelper:NetHelper):Promise<OauthIdpConfig> {
    return netHelper.fetchJson(configUrl).then(
        info => info as OauthIdpConfig
    );
}

/**
 * Generate a randomish string suitable for
 * a CSRF token
 */
export function randomString():string {
    return crypto.createHash('md5').update(Math.random().toString(36).substring(2) + Date.now()).digest('hex');
}

/**
 * Verify the signature on the given jwt token
 * with the given public key
 * See https://github.com/stevenalexander/node-aws-cognito-oauth2-example/blob/master/app.js
 * 
 * @param tokenStr 
 * @param jwk key info from .well-known/jwks.json
 * @return Promise resolves to decoded token, else
 *          rejects with error
 */
export function verifyToken(tokenStr:string, jwk:JWK):Promise<any> {
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

const helper:ConfigHelper = new JsonFileHelper(
    process.env['AUTHN_CONFIG_FILE'] || 
        (homedir + "/.local/share/littleware/authn/config.json")
);

/**
 * load config from json file, and apply
 * environment variable overrides
 * 
 * @param jsonFile optional defaults to     process.env['AUTHN_CONFIG_FILE'] || 
 *      (homedir + "/.local/share/littleware/authn/config.json")
 * @return Promise<Config>
 */
export function loadConfigFromFile(jsonFile?:string):Promise<Config> {
    return helper.loadConfig(jsonFile).then(
        (json) => {
            const config = json as Config;
            config.clientSecret = process.env['AUTHN_CLIENT_SECRET'] || config.clientSecret;
            config.clientId = process.env['AUTHN_CLIENT_ID'] || config.clientId;
            return config;
        }
    );
}

export function buildClient(config:Config, netHelper:NetHelper):OidcClient {
    return new  SimpleOidcClient(config, netHelper);
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