import { LazyProvider } from "@littleware/little-elements/commonjs/common/provider.js";
import { createLogger } from "bunyan";
import * as querystring from "querystring";
import * as util from "util";

import { getNetHelper } from "./netHelper.js";
import { buildClient, FullConfig, OidcClient } from "./oidcClient.js";

const log = createLogger({ name: "little-authn/lambdaBridge" });

/**
 *
 * @param cookieStr a=v; b=v; c=v
 * @return key:value map
 */
export function parseCookies(cookieStr: string): { [key: string]: string} {
    return cookieStr.split(/;\s*/).map(
        (s) => s.split("="),
    ).reduce(
        (acc, it) => { if (it.length === 2) { acc[it[0]] = it[1]; } return acc; },
        {},
    );
}

/**
 * Build a set-cookie string
 * See https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie
 *
 * @param name
 * @param value
 * @param ttlSecs less than 0 means delete, 0 means session scope
 * @param domain
 */
export function buildCookieString(name: string, value: string, ttlSecs: number = 0, domain: string = ""): string {
    let result = `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=None`;
    if (ttlSecs < 0) {
        result += "; Expires=Thu, 01 Jan 1970 00:00:00 GMT";
    } else if (ttlSecs > 0) {
        result += `; Max-Age=${ttlSecs}`;
    }
    if (domain) {
        result += `; Domain=${domain}`;
    }
    return result;
}

/**
 * Build a redirect uri after verifying that the requested redirect
 * domain is in the whitelist and adding the state to the query params
 *
 * @param requestedRedirectUrl
 * @param redirectWhitelist
 * @param state
 * @return redirect or empty string if requested redirect is not in the whitelist
 */
export function buildRedirectUrl(requestedRedirectUrl: string, redirectWhitelist: string[], state: string): string {
    const clientRedirectUri = new URL(requestedRedirectUrl);
    if (redirectWhitelist.find((rule) => clientRedirectUri.hostname.endsWith(rule))) {
        // redirect to the client
        clientRedirectUri.searchParams.set("state", state);
        return clientRedirectUri.toString();
    }
    return "";
}

const authCookieName = "__Secure-Authorization";
const logoutStateCookieName = "__Secure-LogoutState";

// tslint:disable
/**
 * Factory for lambda handler given a config.
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Context doc: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html
 * @param {Object} context
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 */
// tslint:enable
export function lambdaHandlerFactory(configProvider: LazyProvider<FullConfig>): (event, context) => Promise<any> {
    if (process.env.DEBUG) {
        configProvider.get().then(
            (config) => {
                log.info({ config }, "Loaded configuration");
            },
        );
    }

    const clientProvider: LazyProvider<OidcClient> = configProvider.then(
        () => buildClient(configProvider, getNetHelper()),
        );

    async function lambdaHandler(event, context) {
        const subject = process.env.AUTHN_SUBJECT || "world";
        const response = {
            body: {
                message: `hello, ${subject}!`,
                path: event.path,
                // location: ret.data.trim()
            } as any,
            headers: { "Content-Type": "application/json; charset=utf-8" } as {[key: string]: string},
            isBase64Encoded: false,
            statusCode: 200,
            // "multiValueHeaders": { "headerName": ["headerValue", "headerValue2", ...], ... },
        };
        if (!event.queryStringParameters) {
            // avoid undefined
            event.queryStringParameters = {};
        }
        try {
            const client = await clientProvider.get();
            const config = await client.config;

            if (/\/loginCallback$/.test(event.path)) {
                const code = event.queryStringParameters.code;
                const result = {
                    message: "",
                    status: "ok",
                };
                try {
                    const loginResult = await client.completeLogin(code);
                    response.body = loginResult.authInfo;
                    response.headers["Set-Cookie"] = buildCookieString(authCookieName, loginResult.tokenStr, 864000, config.clientConfig.cookieDomain);
                } catch (err) {
                    // clear authorization cookie on failed login
                    response.headers["Set-Cookie"] = buildCookieString(authCookieName, "", -1, config.clientConfig.cookieDomain);
                    response.statusCode = 400;
                    result.message = "error on code verification";
                    result.status = "error";
                    response.body = result;
                }
                const callbackState = JSON.parse(decodeURIComponent(event.queryStringParameters["state"] || "{}"));
                if (callbackState && callbackState.clientRedirectUri) {
                    const redirectUrlStr = buildRedirectUrl(callbackState.clientRedirectUri, config.clientConfig.clientWhitelist, JSON.stringify(result));
                    if (redirectUrlStr) {
                        // redirect to the client
                        response.statusCode = 302;
                        response.headers.Location = redirectUrlStr;
                    }
                }
            } else if (/\/logoutCallback$/.test(event.path)) {
                //
                // cognito /logout does not have a state parameter,
                // so stash state in a cookie - see /logout below
                //
                const cookie = parseCookies(event.headers.Cookie || event.headers.cookie || "")[logoutStateCookieName] || "{}";
                const callbackState = JSON.parse(decodeURIComponent(cookie));
                response.headers["Set-Cookie"] = buildCookieString(authCookieName, "", -1, config.clientConfig.cookieDomain);
                response.body.message = "goodbye!";

                if (callbackState && callbackState.clientRedirectUri) {
                    const result = {
                        message: "",
                        status: "ok",
                    };
                    const redirectUrlStr = buildRedirectUrl(callbackState.clientRedirectUri, config.clientConfig.clientWhitelist, JSON.stringify(result));
                    if (redirectUrlStr) {
                        // redirect to the client
                        response.statusCode = 302;
                        response.headers.Location = redirectUrlStr;
                    }
                }
            } else if (/\/user$/.test(event.path)) {
                // Allow CORS to /user/ endpoint from whitelisted origins
                const originHeader = event.headers.origin || event.headers.Origin;
                if (originHeader) {
                    const origin = new URL(originHeader);
                    if (config.clientConfig.clientWhitelist.find((rule) => origin.hostname.endsWith(rule))) {
                        // add CORS headers
                        response.headers = {
                            ... response.headers,
                            "Access-Control-Allow-Credentials": "true",
                            "Access-Control-Allow-Headers": "Accept",
                            "Access-Control-Allow-Methods": "GET",
                            "Access-Control-Allow-Origin": origin.origin,
                            "Access-Control-Max-Age": "86400",
                        };
                    }
                }
                if (event.httpMethod === "OPTIONS") {
                    return response;
                }
                const cookie = parseCookies(event.headers.Cookie || event.headers.cookie || "")[authCookieName];
                const authHeader = (event.headers.Authorization || event.headers.authorization || "").replace(/^bearer\s+/i, "");
                const tokenStr = (authHeader || cookie || "").replace(/^bearer\s+/, "");
                const sessionTtlMins = +event.queryStringParameters["sessionTtlMins"] || 0;
                if (tokenStr) {
                    try {
                        response.body = await client.getAuthInfo(tokenStr, sessionTtlMins);
                    } catch (err) {
                        response.statusCode = 400;
                        response.body = { error: "failed to validate auth token" };
                    }
                } else {
                    // event.headers.Authorization ||  } else {
                    response.statusCode = 400;
                    response.body = { error: "auth token not provided" };
                }
            } else if (/\/login$/.test(event.path)) {
                //
                // /login and /logout are accessed via redirect,
                // CORS fetch is not allowed
                //
                const clientRedirectUri = new URL(
                    event.queryStringParameters["redirect_uri"] || event.headers.Referer || "",
                    );
                if (config.clientConfig.clientWhitelist.find((rule) => clientRedirectUri.hostname.endsWith(rule))) {
                    const queryparams = querystring.encode(
                        {
                            client_id: config.clientConfig.clientId,
                            identity_provider: "Google",
                            redirect_uri: config.clientConfig.loginCallbackUri,
                            response_type: "code",
                            state: JSON.stringify({ clientRedirectUri: `${clientRedirectUri}` }),
                        },
                    );
                    const   idpUri = `${config.idpConfig.authorization_endpoint}?${queryparams}`;
                    response.statusCode = 302;
                    response.headers.Location = idpUri;
                } else {
                    response.statusCode = 400;
                    response.body = { error: "redirect_uri not in white list" };
                }
            } else if (/\/logout$/.test(event.path)) {
                //
                // /login and /logout are accessed via redirect
                // CORS fetch is not allowed
                //
                const clientRedirectUri = new URL(
                    event.queryStringParameters["redirect_uri"] || event.headers.Referer || "",
                    );
                if (config.clientConfig.clientWhitelist.find((rule) => clientRedirectUri.hostname.endsWith(rule))) {
                    //
                    // cognito /logout does not have a state parameter,
                    // so stash state in a cookie
                    //
                    const callbackCookie = encodeURIComponent(JSON.stringify({ clientRedirectUri: `${clientRedirectUri}` }));
                    const queryparams = querystring.encode(
                        {
                            client_id: config.clientConfig.clientId,
                            logout_uri: `${config.clientConfig.logoutCallbackUri}`,
                        },
                    );
                    const authUrl = new URL(config.idpConfig.authorization_endpoint);
                    const idpUri = `https://${authUrl.host}/logout?${queryparams}`;
                    response.statusCode = 302;
                    response.headers["Set-Cookie"] = buildCookieString(logoutStateCookieName, callbackCookie, 180);
                    response.headers.Location = idpUri;
                } else {
                    response.statusCode = 400;
                    response.body = { error: "redirect_uri not in white list" };
                }
            } else {
                response.statusCode = 404;
                response.body = { error: `unknown path ${event.path}` };
            }
        } catch (err) {
            // tslint:disable-next-line
            log.error({ error: util.inspect(err) }, `failed to handle ${event.path}`);
            response.statusCode = 500;
            response.body = {
                error: "error!",
            };
        }

        if (response.body && typeof response.body === "object") {
            response.body = JSON.stringify(response.body);
        }
        return response;
    }

    return lambdaHandler;
}
