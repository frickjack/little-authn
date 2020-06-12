import {loadConfigByRule} from "../configHelper.js";
import {buildCookieString, lambdaHandlerFactory, parseCookies} from "../lambdaBridge.js";

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
        let expected = `${name}=${value}; Path=/; Secure; HttpOnly`;
        expect(cookieStr).toBe(expected);
        cookieStr = buildCookieString(name, value, 300);
        expected = `${name}=${value}; Path=/; Secure; HttpOnly; Max-Age=300`;
        expect(cookieStr).toBe(expected);
        cookieStr = buildCookieString(name, value, 300);
        expected = `${name}=${value}; Path=/; Secure; HttpOnly; Max-Age=300`;
        expect(cookieStr).toBe(expected);
        cookieStr = buildCookieString(name, value, -1);
        expected = `${name}=${value}; Path=/; Secure; HttpOnly; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        expect(cookieStr).toBe(expected);
        cookieStr = buildCookieString(name, value, 300, ".cookie.domain");
        expected = `${name}=${value}; Path=/; Secure; HttpOnly; Max-Age=300; Domain=.cookie.domain`;
        expect(cookieStr).toBe(expected);
    });
});
