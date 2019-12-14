import { loadFromFile, loadFromRule } from "../configHelper.js";

const configPath = `${__dirname}/testConfig.json`;

describe("the ConfigHelper", () => {
    it("loads config from json", async (done) => {
        try {
            const config = await loadFromFile(configPath, 300).thing;
            expect(config.idpConfigUrl).toBe("https://cognito-idp.us-east-1.amazonaws.com/us-east-1_yanFUVDYv/.well-known/openid-configuration");
            expect(config.idpConfig.jwks_uri).toBe("https://cognito-idp.us-east-1.amazonaws.com/us-east-1_yanFUVDYv/.well-known/jwks.json");
            done();
        } catch (err) {
            done.fail(err);
        }
    });

    it("loads config by rule", async (done) => {
        try {
            const config = await loadFromRule({ type: "file", path: configPath, ttlSecs: 300 }).thing;
            expect(config.idpConfigUrl).toBe("https://cognito-idp.us-east-1.amazonaws.com/us-east-1_yanFUVDYv/.well-known/openid-configuration");
            expect(config.idpConfig.jwks_uri).toBe("https://cognito-idp.us-east-1.amazonaws.com/us-east-1_yanFUVDYv/.well-known/jwks.json");
            done();
        } catch (err) {
            done.fail(err);
        }
    });
});
