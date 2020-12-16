import {loadConfigByRule} from "../configHelper.js";
import {buildCookieString, buildRedirectUrl, lambdaHandlerFactory, parseCookies} from "../lambdaBridge.js";

describe("the authn lambdaBridge", () => {
    it("can say hello", (done) => {
        const configProvider = loadConfigByRule({ value: `${__dirname}/testConfig.json` });
        const lambdaHandler = lambdaHandlerFactory(configProvider);
        lambdaHandler({path: "/whatever"}, {}).then(
            (response) => {
                expect(response.body).toBeDefined();
                const body = JSON.parse(response.body);
                expect(response.statusCode).toBe(404);
                expect(body.error).toMatch(/^unknown path/);
                done();
            },
            (err) => {
                done.fail("lambda bridge failed?");
            },
        );
    });

    it("can parse cookies", () => {
        const testResult = {
            abc: "def",
            123: "456",
            apple: "orange",
        };
        const testStr = Object.entries(testResult).map(
            (it) => it.join("="),
        ).join("; ");
        const cookies = parseCookies(testStr);
        Object.entries(cookies).forEach(
            (it) => {
                expect(testResult[it[0]]).toBe(it[1]);
            },
        );
        expect(Object.entries(cookies).length).toBe(
            Object.entries(testResult).length,
        );
    });

    it("can set cookies", () => {
        const name = "testCookie";
        const value = `bla-${Date.now()}`;
        let cookieStr = buildCookieString(name, value);
        let expected = `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=None`;
        expect(cookieStr).toBe(expected);
        cookieStr = buildCookieString(name, value, 300);
        expected = `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=None; Max-Age=300`;
        expect(cookieStr).toBe(expected);
        cookieStr = buildCookieString(name, value, 300);
        expected = `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=None; Max-Age=300`;
        expect(cookieStr).toBe(expected);
        cookieStr = buildCookieString(name, value, -1);
        expected = `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=None; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        expect(cookieStr).toBe(expected);
        cookieStr = buildCookieString(name, value, 300, ".cookie.domain");
        expected = `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=None; Max-Age=300; Domain=.cookie.domain`;
        expect(cookieStr).toBe(expected);
    });

    it("can build a redirect url", () => {
        const state = "whatever";
        const whitelist = [ "localhost", ".frickjack.com" ];
        const tests = [
            {
                in: "http://localhost:3000/frickjack?state=bla&whatever=123#/a/b/cd",
                out: "http://localhost:3000/frickjack?state=whatever&whatever=123#/a/b/cd",
            },
            {
                in: "https://apps.frickjack.com/frickjack",
                out: "https://apps.frickjack.com/frickjack?state=whatever",
            },
            {
                in: "https://apps.not-frickjack.com/frickjack",
                out: "",
            },
        ];
        for (const it of tests) {
            expect(buildRedirectUrl(it.in, whitelist, state)).toEqual(it.out);
        }
    });
});
