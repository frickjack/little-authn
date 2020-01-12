import jwkToPem = require("jwk-to-pem");
import {getNetHelper} from "../netHelper.js";
import {loadFullConfig, fetchIdpConfig} from "../configHelper.js";
import {buildClient, JWK, verifyToken} from "../oidcClient.js";

describe("the oidcClient module", () => {
    const googleConfigUrl = "https://accounts.google.com/.well-known/openid-configuration";
    const configThing = loadFullConfig({ path: `${__dirname}/testConfig.json` });
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

    it("can retrieve a key", (done) => {
        // from https://www.googleapis.com/oauth2/v3/certs
        client.getKey("47456b8069e4365e517ca5e29757d1a9efa567ba"
        ).then(
            (key) => {
                expect((key as any).n).toBe("rEpSQ8IO8Gauj5AGRbgfwfaxHRMGONuTog4fWKWzZYxdWa76khbynWTAzUJVzw_FaAiZGnl7tlmD7pdKWOHszrcK2Hru87KzeRnnqvWlSqdKValu6x5TfBnJwxgr-L8Mnu4xNnrMG2AWcRkjFVWQmwZyEF3WroRzbxrVTlChD_UydnRuiV1z0BPkLOxTzF5RH21ukImElOm3AFIFXP5h8Z0yLrFEcxzLgDIt7wC68apH7uRmy2-a9D4b4Jwi3HRlAgsYAKXYeEQC3f8Mv03liJBv3CPZU4EyXLQUJA28b8l5NUSDI9tnbrfP8SIXlqLz8mNfuKR18LAU3s9sv-sR3Q");
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
                expect(config.clientConfig.idpConfigUrl).toBe("https://accounts.google.com/.well-known/openid-configuration");
                expect(config.idpConfig.jwks_uri).toBe("https://www.googleapis.com/oauth2/v3/certs");
                done();
            },
        ).catch(
            (err) => { done.fail(err); },
        );
    });
});
