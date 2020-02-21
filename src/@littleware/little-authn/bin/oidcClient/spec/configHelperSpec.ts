import { loadConfigByRule } from "../configHelper.js";

const configPath = `${__dirname}/testConfig.json`;

describe("the ConfigHelper", () => {
    it("loads config from json", async (done) => {
        try {
            const config = await loadConfigByRule({
                value: configPath,
                ttlSecs: 300,
                type: "file",
            }).get();
            // tslint:disable-next-line
            expect(config.clientConfig.idpConfigUrl).toBe("https://accounts.google.com/.well-known/openid-configuration");
            expect(config.idpConfig.jwks_uri).toBe("https://www.googleapis.com/oauth2/v3/certs");
            done();
        } catch (err) {
            done.fail(err);
        }
    });

});
