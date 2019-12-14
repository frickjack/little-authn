import jwkToPem = require("jwk-to-pem");
import {getNetHelper} from "../netHelper.js";
import {loadFromFile} from "../configHelper.js";
import {buildClient, Config, fetchIdpConfig, JWK, OauthIdpConfig, randomString, verifyToken} from "../oidcClient.js";

describe("the oidcClient module", () => {
    const googleConfigUrl = "https://accounts.google.com/.well-known/openid-configuration";
    const configThing = loadFromFile(__dirname + "/testConfig.json", 300);
    const client = buildClient(
                configThing, getNetHelper(),
            );

    it("can retrive well known OIDC configuartion", (done) => {
        fetchIdpConfig(googleConfigUrl, getNetHelper()).then(
            (config) => {
                const rxHttps = /^https:\/\//;
                expect(config.issuer).toMatch(rxHttps);
                expect(config.authorization_endpoint).toMatch(rxHttps);
                expect(config.jwks_uri).toMatch(rxHttps);
                expect(config.token_endpoint).toMatch(rxHttps);
                expect(config.userinfo_endpoint).toMatch(rxHttps);
                done();
            },
        ).catch(
            (err) => {
                done.fail(`Failed to retrieve idp config from ${googleConfigUrl}`);
            },
        );
    });

    const testToken = "eyJraWQiOiIxVkhLT01xSm9jWlJBWGNUTUFrUFRCdDZrOWE0bjl2bzVicFRTWTl6RkpjPSIsImFsZyI6IlJTMjU2In0.eyJhdF9oYXNoIjoiVVRLOVBRcE82WDBtZEtsY0NMLUFLZyIsInN1YiI6IjRmNTQ5MTg4LTZiNWEtNDk5My1iOTc5LTJkZWRlOGY5MzVkMCIsImNvZ25pdG86Z3JvdXBzIjpbInVzLWVhc3QtMV95YW5GVVZEWXZfR29vZ2xlIiwiYWRtaW5zIl0sImNvZ25pdG86cHJlZmVycmVkX3JvbGUiOiJhcm46YXdzOmlhbTo6MDI3MzI2NDkzODQyOnJvbGVcL0NvZ25pdG9fbGl0dGxld2FyZV9hcHBzQXV0aF9Sb2xlIiwiaXNzIjoiaHR0cHM6XC9cL2NvZ25pdG8taWRwLnVzLWVhc3QtMS5hbWF6b25hd3MuY29tXC91cy1lYXN0LTFfeWFuRlVWRFl2IiwiY29nbml0bzp1c2VybmFtZSI6Ikdvb2dsZV8xMDAyNzc5NTQxNTQxNjg3NTM4MjIiLCJjb2duaXRvOnJvbGVzIjpbImFybjphd3M6aWFtOjowMjczMjY0OTM4NDI6cm9sZVwvQ29nbml0b19saXR0bGV3YXJlX2FwcHNBdXRoX1JvbGUiXSwiYXVkIjoiM3M1Z200NnI2a2hxNGtvOWJydmRmOGFxMjIiLCJpZGVudGl0aWVzIjpbeyJ1c2VySWQiOiIxMDAyNzc5NTQxNTQxNjg3NTM4MjIiLCJwcm92aWRlck5hbWUiOiJHb29nbGUiLCJwcm92aWRlclR5cGUiOiJHb29nbGUiLCJpc3N1ZXIiOm51bGwsInByaW1hcnkiOiJ0cnVlIiwiZGF0ZUNyZWF0ZWQiOiIxNTM0MDEzNzgzOTg5In1dLCJ0b2tlbl91c2UiOiJpZCIsImF1dGhfdGltZSI6MTU1NDY3MTE2NSwiZXhwIjoxNTU0Njc0NzY1LCJpYXQiOjE1NTQ2NzExNjUsImVtYWlsIjoicmV1YmVuQGZyaWNramFjay5jb20ifQ.DN8EFvo1A69Cdn49FpTJAzLN9NH1YF9lfeqTpzuQWCWPmEitFKgNajtghxeRM0n1QS1Z6ZsJKciCOTHOEqsfFYvd_e1unwDYGi9gxcDa27o5k_DLrfd-g9VnYqGPNYTtdgOv4ACODPeDxLzE4M8z28aCwkdYO20ZAMPW1LVzP-b8teyZ6-BrTYiS_0IRGIzDIDMHeLEt53_mPGbPQlmj9uuE_KIYiqetRy-cn7s403HC8dfdLh5B6MsPJYzqxq-2Ws_nl6M-h0RnyvzeNf3a5Oo4ZKZCrm41ouEdFBSUvUhum7nstwbxN5UQFpEQDVpJ7ojgHjq4R8XgIJs6x_tTTg";
    const jwk = {
        alg: "RS256",
        e: "AQAB",
        kid: "1VHKOMqJocZRAXcTMAkPTBt6k9a4n9vo5bpTSY9zFJc=",
        kty: "RSA",
        n: "gMRf3kbK7xzFrRwpkFw5JFngiXN-HtKZzUGoDtdqep7aLRoNdA-hD6ncQ75vKvfAtQ5TzzFl441b_NVk8ZwwqSGML6ZD3AQNP6cLgqpl7v8YYm_t3Xt8HEB3UKv-0CTygtXxp-PfVqa_xSiU0J4wFNIEkl5u7foBVVeGsIkQtwY-QcNY42hbXzROiBFKF0iTvmvkYZmo33ECjqWNjC7MprtTOCYN3dgeQfUVyV3Mt1GZATTxqSiMmkNEfbwihNWQFu9WJHvByz6-YuuP0dgYrM0O_d5Y2vdLAh466kUmbfzPukRTp5W8ftd6JengITgUbLfYJsxKHfuw6G1SrYf6GQ",
        use: "sig",
    } as JWK;
    it("can convert jwk to pem", () => {
        const pem: string = jwkToPem(jwk);
        // tslint:disable-next-line
        console.log(`Got pem ${pem}`);
        expect(pem).toBeDefined();
    });

    it("can verify a token", (done) => {
        verifyToken(testToken, jwk).then(
            (info) => {
                expect(info.email).toEqual("reuben@frickjack.com");
                done();
            },
        ).catch(
            (err) => {
                done.fail(`Failed to verify token - ${err}`);
            },
        );
    });

    it("can authenticate given a token", (done) => {
        client.getAuthInfo(testToken
        ).then(
            (authInfo) => {
                expect(authInfo.email).toBe("reuben@frickjack.com");
                done();
            },
        ).catch(
            (err) => { done.fail(err); },
        );
    });

    it("can retrieve a key", (done) => {
        client.getKey("1VHKOMqJocZRAXcTMAkPTBt6k9a4n9vo5bpTSY9zFJc="
        ).then(
            (key) => {
                expect((key as any).n).toBe("gMRf3kbK7xzFrRwpkFw5JFngiXN-HtKZzUGoDtdqep7aLRoNdA-hD6ncQ75vKvfAtQ5TzzFl441b_NVk8ZwwqSGML6ZD3AQNP6cLgqpl7v8YYm_t3Xt8HEB3UKv-0CTygtXxp-PfVqa_xSiU0J4wFNIEkl5u7foBVVeGsIkQtwY-QcNY42hbXzROiBFKF0iTvmvkYZmo33ECjqWNjC7MprtTOCYN3dgeQfUVyV3Mt1GZATTxqSiMmkNEfbwihNWQFu9WJHvByz6-YuuP0dgYrM0O_d5Y2vdLAh466kUmbfzPukRTp5W8ftd6JengITgUbLfYJsxKHfuw6G1SrYf6GQ");
                done();
            },
        ).catch(
            (err) => {
                done.fail(err);
            },
        );
    });

    it("can load configuration", (done) => {
        configThing.thing.then(
            (config) => {
                expect(config.idpConfigUrl).toBe("https://cognito-idp.us-east-1.amazonaws.com/us-east-1_yanFUVDYv/.well-known/openid-configuration");
                expect(config.idpConfig.jwks_uri).toBe("https://cognito-idp.us-east-1.amazonaws.com/us-east-1_yanFUVDYv/.well-known/jwks.json");
                done();
            },
        ).catch(
            (err) => { done.fail(err); },
        );
    });
});
