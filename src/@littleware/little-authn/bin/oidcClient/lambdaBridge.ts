import { LazyProvider } from "@littleware/little-elements/commonjs/common/provider.js";
import { createLogger } from "bunyan";
import { loadFullConfig } from "./configHelper.js";
import { getNetHelper } from "./netHelper.js";
import { buildClient, FullConfig, OidcClient, randomString, verifyToken } from "./oidcClient.js";

const log = createLogger({ name: "little-authn/lambdaBridge" });

const configThing = loadFullConfig();
if (process.env.DEBUG) {
    configThing.get().then(
        (config) => {
            // tslint:disable-next-line
            log.info({ config: config }, "Loaded configuration");
        },
    );
}

const clientThing: LazyProvider<OidcClient> = new LazyProvider<OidcClient>(
    () => {
        return Promise.resolve(buildClient(configThing, getNetHelper()));
    }, 0,
);

/**
 * Initialize and cache client
 */
function getClient(): Promise<OidcClient> {
    return clientThing.get();
}

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


/* tslint:disable */
/**
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Context doc: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html
 * @param {Object} context
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 */
/* tslint:enable */
export async function lambdaHandler(event, context) {
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
    try {
        const client = await getClient();

        if (/\/loginCallback$/.test(event.path)) {
            const code = event.queryStringParameters.code;
            const result = await client.completeLogin(code);
            response.body = result.authInfo;
            response.headers["Set-Cookie"] = `Authorization=${result.tokenStr}; Max-Age=864000; path=/; secure; HttpOnly`;
        } else if (/\/logoutCallback$/.test(event.path)) {
            // blaheaders
            response.headers["Set-Cookie"] = `Authorization=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; secure; HttpOnly`;
        } else if (/\/user$/.test(event.path)) {
            const cookie = parseCookies(event.headers.Cookie || event.headers.cookie || "").Authorization;
            const authHeader = (event.headers.Authorization || event.headers.authorization || "").replace(/^bearer\s+/i, "");
            const tokenStr = (authHeader || cookie || "").replace(/^bearer\s+/, "");
            if (tokenStr) {
                try {
                    response.body = await client.getAuthInfo(tokenStr);
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
            response.statusCode = 302;
            response.headers.Location = await client.config.then((config) => config.idpConfig.authorization_endpoint);
        } else {
            response.statusCode = 404;
            response.body = { error: `unknown path ${event.path}` };
        }
    } catch (err) {
        // tslint:disable-next-line
        log.error({ error: err }, `failed to handle ${event.path}`);
        response.statusCode = 500;
        response.body = {
            message: "error!",
        };
    }

    if (response.body && typeof response.body === "object") {
        response.body = JSON.stringify(response.body);
    }
    return response;
}
