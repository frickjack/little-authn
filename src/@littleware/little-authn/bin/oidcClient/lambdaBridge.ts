import {LazyThing} from "@littleware/little-elements/commonjs/common/mutexHelper.js";
import { loadFromRuleString } from './configHelper.js';
import { buildClient, Config, fetchIdpConfig, JWK, OauthIdpConfig, OidcClient, randomString, verifyToken } from "./oidcClient.js";
import { getNetHelper } from './netHelper.js';

const clientThing:LazyThing<OidcClient> = new LazyThing<OidcClient>(
    () => Promise.resolve(buildClient(loadFromRuleString(), getNetHelper())), 0
);

/**
 * Initialize and cache client
 */
function getClient():Promise<OidcClient> {
    return clientThing.thing;
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
        headers: { "Content-Type": "application/json; charset=utf-8" },
        isBase64Encoded: false,
        statusCode: 200,
        // "multiValueHeaders": { "headerName": ["headerValue", "headerValue2", ...], ... },
    };
    try {
        const client = await getClient();
        
        if (/\/completeLogin$/.test(event.path)) {
            const code = event.queryStringParameters["code"];
            const result = await client.completeLogin(code);
        } else if (/\/user$/.test(event.path)) {
            const cookie = event.headers["Cookie"] || "";
            const authHeader = (event.headers["Authorization"] || "").replace(/^bearer\s+/i, "");
            const tokenStr = authHeader || cookie;
            response.body = await client.getAuthInfo(tokenStr);
        } else if (/\/login$/.test(event.path)) {
            response.statusCode = 302;
            
            response.headers["Location"] = client.config.then(config => config.idpConfig.authorization_endpoint);
        }
    } catch (err) {
        // tslint:disable-next-line
        console.log(err);
        response.statusCode = 500;
        response.body = {
            message: "error!",
        };
    }

    if (response.body && typeof response.body === 'object') {
        response.body = JSON.stringify(response.body);
    }
    return response;
};
