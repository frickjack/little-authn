import { LoadRule } from "@littleware/little-elements/commonjs/bin/configHelper.js";
import { expressWrap } from "@littleware/little-elements/commonjs/bin/expressLambdaWrapper.js";
import { Router } from "express";
import { loadConfigByRule } from "./configHelper.js";
import { lambdaHandlerFactory } from "./lambdaBridge.js";


/**
 * Async router factory suitable for little-server.
 * Expects the `LITTLE_AUTHN_CONFIG` environment
 * variable to be set with a load rule.
 */
export function expressRouter(): Promise<Router> {
    const loadRule = JSON.parse(process.env.LITTLE_AUTHN_CONFIG || "");
    if (!loadRule) {
        return Promise.reject("Unable to load config from LITTLE_AUTHN_CONFIG environment rule");
    }
    const configProvider = loadConfigByRule(loadRule as LoadRule);
    return configProvider.then(
        (config) => {
            return expressWrap(
                lambdaHandlerFactory(configProvider),
            );
        },
    ).get();
}
