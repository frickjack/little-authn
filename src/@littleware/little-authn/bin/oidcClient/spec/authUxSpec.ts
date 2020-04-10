import { ifInteractive, interactive } from "@littleware/little-elements/commonjs/bin/testHelper.js";
import { createLogger } from "bunyan";
import { Agent } from "https";

const log = createLogger({ name: "little-authn/authUxSpec" });

describe("the littleware login user experience", () => {
    let baseAuthUrl = "https://localhost:3043/authn";
    const httpsAgent = new Agent({ rejectUnauthorized: false });

    beforeAll(
        () => {
            if (process.env["LITTLE_AUTHN_BASE"]) {
                baseAuthUrl = process.env["LITTLE_AUTHN_BASE"];
            }
            log.info(`baseAuthUrl set to ${baseAuthUrl}`);
            try {
                log.info(`baseAuthUrl set to: ${new URL(baseAuthUrl)}`);
            } catch (ex) {
                fail(`Invalid base authn url: ${baseAuthUrl}`);
            }
        },
    );

    afterAll(() => { httpsAgent.destroy(); });

    it("implements the login flow", ... ifInteractive(async () => {
        const result = await interactive(
            `
Exercise the login flow:
* To login, visit ${baseAuthUrl}/login?redirect_uri=https://localhost:3043/authn/user
* Verify that login succeeds and the Authorization cookie is set to a valid token - test at https://apps.frickjack.com/jwt/index.html
* To logout, visit ${baseAuthUrl}/logout?redirect_uri=https://localhost:3043/authn/user
`,
        );
        expect(result.didPass).withContext(result.details).toBe(true);
    }, 600000) as any);
});
