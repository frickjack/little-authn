import {squish} from "@littleware/little-elements/commonjs/common/mutexHelper.js";
import {LazyProvider} from "@littleware/little-elements/commonjs/common/provider.js";
import { createLogger } from "bunyan";
import crypto = require("crypto");
import jsonwebtoken = require("jsonwebtoken");
import jwkToPem = require("jwk-to-pem");
import querystring = require("querystring");
import { NetHelper } from "./netHelper";

const log = createLogger({ name: "little-authn/oidcClient" });

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
    sessionTtlMins: number;
    sessionMinIat: number;
    // trusted domains for login/logout redirect_uri
    clientWhitelist: string[];
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
     * @param sessionTtlMins number of minutes a token should live
     *    from its issued at time (iat) before it expires - defaults
     *    to config.clientConfig.sessionTtlMins
     */
    getAuthInfo(tokenStr: string, sessionTtlMins?: number): Promise<AuthInfo>;

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
    private _config: LazyProvider<FullConfig>;

    get config(): Promise<FullConfig> { return this._config.get(); }

    // tslint:disable-next-line
    private _keyCache: LazyProvider<{ [key: string]: JWK }>;

    get keyCache(): Promise<{ [key: string]: JWK }> {
        return this._keyCache.get();
    }

    // tslint:disable-next-line
    private _netHelper: NetHelper = null;

    constructor(config: LazyProvider<FullConfig>, netHelper: NetHelper) {
        this._config = config;
        this._netHelper = netHelper;
        const keyDb: { [key: string]: JWK } = {};
        const keyRefresh: () => Promise<{ [key: string]: JWK }> =
            squish(
                async () => {
                    const keysUrl = await this._config.get().then(
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
        this._keyCache = new LazyProvider<{ [key: string]: JWK }>(
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
    public getAuthInfo(tokenStr: string, sessionTtlMinsIn?: number): Promise<AuthInfo> {
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
            async (token: any) => {
                const config = await this.config;
                const sessionTtlMins = sessionTtlMinsIn || config.clientConfig.sessionTtlMins;
                if (token.iat < config.clientConfig.sessionMinIat) {
                    throw new Error(`token issued after min iat`);
                }
                const expires = token.iat + sessionTtlMins * 60;
                if ( Math.floor(Date.now() / 1000) > expires ) {
                    throw new Error(`Login session has expired`);
                }
                return token;
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
                    log.warn({ tokenInfo }, "unexpected response from token endpoint");
                    throw new Error("Failed to retrieve token");
                }
                return this.getAuthInfo(jwt).then(
                    (authInfo: AuthInfo) => {
                        const loginResult: LoginResult = {
                            authInfo,
                            tokenStr: jwt,
                        };
                        return loginResult;
                    },
                );
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

export function buildClient(lazyConfig: LazyProvider<FullConfig>, netHelper: NetHelper): OidcClient {
    return new  SimpleOidcClient(lazyConfig, netHelper);
}
