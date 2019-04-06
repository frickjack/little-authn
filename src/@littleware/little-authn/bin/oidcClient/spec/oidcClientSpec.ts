const client = require('../oidcClient.js');

describe("the oidcClient module", function() {
    const googleConfigUrl = "https://accounts.google.com/.well-known/openid-configuration";
    
    it("can retrive well known OIDC configuartion", function(done) {
        client.fetchIdpConfig(googleConfigUrl).then(
            (config) => {
                const rxHttps = /^https:\/\//;
                expect(config.issuer).toMatch(rxHttps);
                expect(config.authorization_endpoint).toMatch(rxHttps);
                expect(config.jwks_uri).toMatch(rxHttps);
                expect(config.token_endpoint).toMatch(rxHttps);
                expect(config.userinfo_endpoint).toMatch(rxHttps);
                done();
            }
        ).catch(
            (err) => {
                done.fail(`Failed to retrieve idp config from ${googleConfigUrl}`);
            }
        )
    });
});