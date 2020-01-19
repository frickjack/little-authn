import {LazyThing} from "@littleware/little-elements/commonjs/common/mutexHelper.js";
import SecretsManager = require("aws-sdk/clients/secretsmanager.js");
import fs = require("fs");
import os = require("os");
import { getNetHelper, NetHelper } from "./netHelper";
import { ClientConfig, FullConfig, IdpConfig } from "./oidcClient.js";

const homedir = os.homedir();

/**
 * Module for managing loading of configuration
 * from various sources, and reloading that
 * configuration periodically - to account for
 * secret rotation, etc.
 */

 /**
  * Fetch the idp config from the given "well known" url
  *
  * @param configUrl
  */
export function fetchIdpConfig(configUrl: string, netHelper: NetHelper): Promise<IdpConfig> {
    return netHelper.fetchJson(configUrl).then(
        (info) => info as IdpConfig,
    );
}

 /**
  * Load configuration from a file
  *
  * @param fileName
  * @param ttlSecs
  */
export function loadFromFile(fileName: string, ttlSecs: number): LazyThing<ClientConfig> {
    return new LazyThing(
        () => loadJsonFromFile(fileName), ttlSecs,
    );
}

/**
 * Load configuration from a secret
 *
 * @param secretId ARN or name of secret
 * @param ttlSecs rotation period in seconds
 */
export function loadFromSecret(secretId: string, ttlSecs: number): LazyThing<ClientConfig> {
    return new LazyThing(
        () => loadJsonFromSecret(secretId), ttlSecs,
    );
}

export interface LoadRule {
    type: string;
    ttlSecs: number;
    path: string;
}

const defaultRule: LoadRule = {
    path: (homedir + "/.local/etc/littleware/authn/config.json"),
    ttlSecs: 300,
    type: "file",
};

/**
 * Load configuration from the source specified by the given rule.
 *
 * @param ruleIn specifies type of source (currently supports secret
 * or file), ttlSecs, and path - merges with default rule
 */
export function loadFromRule(ruleIn?: LoadRule | { path: string }): LazyThing<ClientConfig> {
    const rule = { ... defaultRule, ... ruleIn || {} };
    if (rule.type === "file") {
        return loadFromFile(rule.path, rule.ttlSecs);
    } else if (rule.type === "secret") {
        return loadFromSecret(rule.path, rule.ttlSecs);
    }
    throw new Error("Unknown type: " + rule.type);
}

/**
 * Load configuration from the source specified by the given rule.
 *
 * @param ruleStr json string parsed to LoadRule - defaults to
 *      process.env.LITTLE_CONFIG if not provided,
 *      and the default rule (homedir + "/.local/share/littleware/authn/config.json")
 *      if the environment variable is not set
 */
export function loadFromRuleString(ruleStr?: string): LazyThing<ClientConfig> {
    const rule = JSON.parse(ruleStr || process.env.LITTLE_CONFIG || "{}") as LoadRule;
    return loadFromRule(rule);
}

export function loadFullConfig(
    rule?: LoadRule | { path: string } | string,
    netHelper?: NetHelper,
): LazyThing<FullConfig> {
    const clientConfigThing: LazyThing<ClientConfig> = (rule && typeof rule === "object") ?
        loadFromRule(rule as LoadRule) : loadFromRuleString(rule as string);
    return clientConfigThing.then(
        async (clientConfig) => {
            const idpConfig = await fetchIdpConfig(clientConfig.idpConfigUrl, netHelper || getNetHelper());
            return { clientConfig, idpConfig } as FullConfig;
        },
    );
}

/**
 * Load the json at the given file
 *
 * @param fileName
 */
export function loadJsonFromFile(fileName: string): Promise<ClientConfig> {
    return new Promise(
        (resolve, reject) => {
            fs.readFile(fileName, "utf8",
                (err, data) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    const config = JSON.parse(data);
                    resolve(config as ClientConfig);
                },
            );
        },
    );
}

export function loadJsonFromSecret(secretId: string): Promise<ClientConfig> {
    const secretsmanager = new SecretsManager();
    return new Promise((resolve, reject) => {
        secretsmanager.getSecretValue({ SecretId: secretId }, (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(data as ClientConfig);
                return;
            },
        );
    });
}
