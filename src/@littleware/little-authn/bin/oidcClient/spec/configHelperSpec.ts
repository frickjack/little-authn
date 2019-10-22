import {JsonFileHelper} from "../configHelper.js";

describe("the ConfigHelper", () => {
    const helper = new JsonFileHelper(__dirname + "/testConfig.json");
    it("loads config from json", (done) => {
        helper.loadConfig().then(
            (config) => {
                expect(config.idpConfigUrl).toBe("https://cognito-idp.us-east-1.amazonaws.com/us-east-1_yanFUVDYv/.well-known/openid-configuration");
                expect(config.idpConfig.jwks_uri).toBe("https://cognito-idp.us-east-1.amazonaws.com/us-east-1_yanFUVDYv/.well-known/jwks.json");
                done();
            },
        ).catch((err) => done.fail(err));
    });
});
