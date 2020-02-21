import {LoadRule, loadFromRule} from "@littleware/little-elements/commonjs/bin/configHelper.js";
import {LazyProvider} from "@littleware/little-elements/commonjs/common/provider.js";
import { getNetHelper, NetHelper } from "./netHelper";
import { ClientConfig, FullConfig, IdpConfig } from "./oidcClient.js";


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
 * Shortcut for loadFromRule({clientConfig: clientConfigRule)})
 * @param clientConfigRule 
 */
export function loadConfigByRule(clientConfigRule: LoadRule):LazyProvider<FullConfig> {
    return loadFromRule({clientConfig: clientConfigRule}).then(
        configMap => loadFullConfig(configMap["clientConfig"] as ClientConfig)
    );
}

export function loadFullConfig(
    clientConfig: ClientConfig,
    netHelper?: NetHelper,
): Promise<FullConfig> {
    return fetchIdpConfig(
        clientConfig.idpConfigUrl, netHelper || getNetHelper()
    ).then(
        (idpConfig) => {
            return { clientConfig, idpConfig } as FullConfig;
        },
    );
}
