import { loadFullConfig, loadFromRule } from "../configHelper.js";

const configPath = `${__dirname}/testConfig.json`;

describe("the ConfigHelper", () => {
    it("loads config from json", async (done) => {
        try {
            const config = await loadFullConfig({
                type: "file",
                ttlSecs: 300,
                path: configPath,
            }).thing;
            expect(config.clientConfig.idpConfigUrl).toBe("https://accounts.google.com/.well-known/openid-configuration");
            expect(config.idpConfig.jwks_uri).toBe("https://www.googleapis.com/oauth2/v3/certs");
            done();
        } catch (err) {
            done.fail(err);
        }
    });

});
