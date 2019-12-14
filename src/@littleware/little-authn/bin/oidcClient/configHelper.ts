import {LazyThing} from "@littleware/little-elements/commonjs/common/mutexHelper.js";
import fs = require("fs");
import os = require("os");
import SecretsManager = require('aws-sdk/clients/secretsmanager.js');

const homedir = os.homedir();

/**
 * Module for managing loading of configuration
 * from various sources, and reloading that
 * configuration periodically - to account for
 * secret rotation, etc.
 */

 /**
  * Load configuration from a file
  * 
  * @param fileName 
  * @param ttlSecs 
  */
export function loadFromFile(fileName: string, ttlSecs: number): LazyThing<any> {
    return new LazyThing(
        () => loadJsonFromFile(fileName), ttlSecs
    );
}

/**
 * Load configuration from a secret
 * 
 * @param secretId ARN or name of secret
 * @param ttlSecs rotation period in seconds
 */
export function loadFromSecret(secretId: string, ttlSecs: number): LazyThing<any> {
    return new LazyThing(
        () => loadJsonFromSecret(secretId), ttlSecs
    )
}

export interface LoadRule {
    type: string,
    ttlSecs: number,
    path: string
}

const defaultRule: LoadRule = {
    type: "file",
    ttlSecs: 300,
    path: (homedir + "/.local/share/littleware/authn/config.json")
};



/**
 * Load configuration from the source specified by the given rule.
 * 
 * @param ruleIn specifies type of source (currently supports secret
 * or file), ttlSecs, and path - merges with default rule
 */
export function loadFromRule(ruleIn?: LoadRule): LazyThing<any> {
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
export function loadFromRuleString(ruleStr?: string): LazyThing<any> {
    const rule = JSON.parse(ruleStr || process.env["LITTLE_CONFIG"] || "{}") as LoadRule;
    return loadFromRule(rule);
}


/**
 * Load the json at the given file
 *
 * @param fileName
 */
export function loadJsonFromFile(fileName: string): Promise<any> {
    return new Promise(
        (resolve, reject) => {
            fs.readFile(fileName, "utf8",
                (err, data) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    const config = JSON.parse(data);
                    resolve(config);
                },
            );
        },
    );
}

export function loadJsonFromSecret(secretId:string):Promise<any> {
    const secretsmanager = new SecretsManager();
    return new Promise((resolve, reject) => {
        secretsmanager.getSecretValue({ SecretId: secretId }, (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(data);
                return;
            }
        );
    });
}

