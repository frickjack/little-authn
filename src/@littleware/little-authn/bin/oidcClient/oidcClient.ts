import {LazyThing, squish} from "@littleware/little-elements/commonjs/common/mutexHelper.js";
import crypto = require("crypto");
import jsonwebtoken = require("jsonwebtoken");
import jwkToPem = require("jwk-to-pem");
import querystring = require("querystring");
import { NetHelper } from "./netHelper";

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
 * Client configuration loaded at startup.
 * Includes the client id and secret for
 * this Oauth client,
 * login callback URI, logout callback URI,
 * and the well-known endpoint for the
 * identity provider (idp) - currently only supports cognito.
 */
export interface ClientConfig {
    // url for retrieving endpoints
    idpConfigUrl: string;
    clientId: string;
    clientSecret: string;
    loginCallbackUri: string;
    logoutCallbackUri: string;
}

/**
 * Identity provider config supporting a particular client config -
 * necessary for executing
 * the login flows.  Usually retrieved from the idp via a .well-known
 * endpoint.
 */
export interface IdpConfig {
    authorization_endpoint: string;
    issuer: string;
    jwks_uri: string;
    token_endpoint: string;
    userinfo_endpoint: string;
    clientConfig: ClientConfig;
}

export interface FullConfig {
    clientConfig: ClientConfig;
    idpConfig: IdpConfig;
}

/**
 * AuthInfo to provide back to user in response body
 */
export interface AuthInfo {
    email: string;
    groups: [string];
    // issued at seconds from epoch
    iat: number;
}

/**
 * LoginResult with AuthInfo to provide to user,
 * and tokenStr to set
 * in identityToken cookie.
 */
export interface LoginResult {
    authInfo: AuthInfo;
    tokenStr: string;
}

export interface OidcClient {
    config: Promise<FullConfig>;
    keyCache: Promise<{ [key: string]: JWK }>;
    /**
     * Last time key cache was refreshed
     */
    lastRefreshTime: number;

    /**
     * Refresh the cached keys from the well known end point
     */
    refreshKeyCache(): Promise<{ [key: string]: JWK }>;

    /**
     * Extract user info (login, etc) from the given token,
     * or set email to `anonymous` if token is invalid or expired.
     * Verifies
     * @param tokenStr signed with key specified in header and
     *      able to retrieve from the key cache
     */
    getAuthInfo(tokenStr: string): Promise<AuthInfo>;

    /**
     * Little helper - gets the given key from the key cache -
     * refreshes cache if key not present and last refresh is over
     * 5 minutes ago ...
     *
     * @param kid
     * @return Promise<JWK>
     */
    getKey(kid: string): Promise<JWK>;

    /**
     * Verify the login callback from the identity provider
     *
     * @param code passed from identity provider via redirect
     * @return LoginResult on success, otherwise reject Promise
     */
    completeLogin(code: string): Promise<LoginResult>;
}

class SimpleOidcClient implements OidcClient {
    // tslint:disable-next-line
    private _config: LazyThing<FullConfig>;

    get config(): Promise<FullConfig> { return this._config.thing; }

    // tslint:disable-next-line
    private _keyCache: LazyThing<{ [key: string]: JWK }>;

    get keyCache(): Promise<{ [key: string]: JWK }> {
        return this._keyCache.thing;
    }

    // tslint:disable-next-line
    private _netHelper: NetHelper = null;

    constructor(config: LazyThing<FullConfig>, netHelper: NetHelper) {
        this._config = config;
        this._netHelper = netHelper;
        const keyDb: { [key: string]: JWK } = {};
        const keyRefresh: () => Promise<{ [key: string]: JWK }> =
            squish(
                async () => {
                    const keysUrl = await this._config.thing.then(
                        (configInfo) => configInfo.idpConfig.jwks_uri,
                    );
                    const info = await this._netHelper.fetchJson(keysUrl);
                    info.keys.forEach(
                        (kinfo: JWK) => {
                            keyDb[kinfo.kid] = kinfo;
                        },
                    );
                    return keyDb;
                },
            );
        this._keyCache = new LazyThing<{ [key: string]: JWK }>(
                () => keyRefresh(),
                300,
            );
    }

    get lastRefreshTime() { return this._keyCache.lastLoadTime; }

    public refreshKeyCache(): Promise<{ [key: string]: JWK }> {
        return this._keyCache.refreshIfNecessary(true).next;
    }

    public getKey(kid: string): Promise<JWK> {
        return this.keyCache.then(
            (kdb) => {
                const result = kdb[kid];
                if (result) {
                    return result;
                }
                throw new Error(`Invalid kid: ${kid}`);
            },
        );
    }

    /**
     * Verify and decode the given token
     *
     * @param tokenStr
     * @return Promise rejected if token fails validation
     */
    public getAuthInfo(tokenStr: string): Promise<AuthInfo> {
        // get the kid from the token
        return new Promise((resolve, reject) => {
            try {
                const kid: string = JSON.parse(Buffer.from(tokenStr.split(".")[0], "base64").toString("utf8")).kid;
                resolve(kid);
            } catch (err) {
                reject(`Failed to extract kid from token: ${err}`);
            }
        }).then(
            (kid: string) => this.getKey(kid),
        ).then(
            (jwk: JWK) => {
                return verifyToken(tokenStr, jwk);
            },
        ).then(
            (token: any) => {
                return {
                    email: token.email,
                    groups: token["cognito:groups"],
                    iat: token.iat,
                };
            },
        );
    }

    public completeLogin(code: string): Promise<LoginResult> {
        return this.config.then(
            (config) => {
                const urlStr = `${config.idpConfig.token_endpoint}`;
                // tslint:disable-next-line
                const credsStr: string = Buffer.from(`${config.clientConfig.clientId}:${config.clientConfig.clientSecret}`).toString("base64");
                return this._netHelper.fetchJson(urlStr, {
                    body: querystring.encode(
                        {
                            code,
                            grant_type: "authorization_code",
                            redirect_uri: config.clientConfig.loginCallbackUri,
                        },
                    ),
                    headers: {
                        "Authorization": `Basic ${credsStr}`,
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    method: "POST",
                });
            },
        ).then(
            (tokenInfo) => {
                const jwt = tokenInfo.id_token;
                if (! jwt) {
                    // console.log("No id token in response", tokenInfo);
                    throw new Error("Failed to retrieve token");
                }
                // tslint:disable-next-line
                const parts = jwt.split(".").map((str, idx) => idx < 2 ? atob(str.replace("-", "+").replace("_", "/")) : str);
                const idToken = parts[1];
                const authInfo: AuthInfo = {
                    email: idToken.email,
                    groups: idToken["cognito:groups"],
                    // issued at seconds from epoch
                    iat: idToken.iat,
                };
                const loginResult: LoginResult = {
                    authInfo,
                    tokenStr: JSON.stringify(idToken),
                };
                return loginResult;
            },
        );
    }
}

/**
 * Generate a randomish string suitable for
 * a CSRF token
 */
export function randomString(): string {
    return crypto.createHash("md5").update(Math.random().toString(36).substring(2) + Date.now()).digest("hex");
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
export function verifyToken(tokenStr: string, jwk: JWK): Promise<any> {
    const pem: string = jwkToPem(jwk);
    return new Promise(
        (resolve, reject) => {
            jsonwebtoken.verify(tokenStr, pem,
                { ignoreExpiration: true },
                (err, decoded) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(decoded);
                },
            );
        },
    );
}

export function buildClient(lazyConfig: LazyThing<FullConfig>, netHelper: NetHelper): OidcClient {
    return new  SimpleOidcClient(lazyConfig, netHelper);
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
