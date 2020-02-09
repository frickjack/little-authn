import {lambdaHandler, parseCookies} from "../lambdaBridge.js";

describe("the authn lambdaBridge", () => {
    it("can say hello", (done) => {
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
});
