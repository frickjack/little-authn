import https = require('https');
import nodeFetch = require('node-fetch');

const agent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 15000,
    maxSockets: 30
  });


export interface NetHelper {
    fetchJson(url:string, opts?:any):Promise<any>;
}

class MockNetHelper implements NetHelper {
    mockResponses: [any];

    fetchJson(url:string, opts:any={}):Promise<any> {
        return new Promise((resolve,reject) => {
            if (this.mockResponses.length > 0) {
                resolve(this.mockResponses.shift());
            } else {
                resolve("");
            }
        });
    }
}

class SimpleNetHelper implements NetHelper {
    fetchJson(url:string, opts:any={}):Promise<any> {
        return nodeFetch(url, {agent, ...opts}).then(
            resp => resp.json()
        );
    }
}

const simpleNetHelper = new SimpleNetHelper();
const mockNetHelper = new MockNetHelper();

/**
 * Config is either "network" or "mock" -
 * default is "network", but can override
 * with the LITTLE_NET_CONFIG environment variable
 */
export function getNetHelper(config?:string):NetHelper {
    config = config || process.env["AUTHN_NET_CONFIG"] || "network";
    if (config != "mock") {
        return simpleNetHelper;
    }
    return mockNetHelper;
}
