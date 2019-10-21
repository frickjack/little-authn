import {LazyThing} from "@littleware/little-elements/commonjs/common/mutexHelper.js";
import fs = require("fs");
import {Config} from "./oidcClient.js";

export interface ConfigHelper {
    loadConfig(fileName?: string): Promise<Config>;
}

/**
 * Load the json at the given file
 *
 * @param fileName
 */
export function loadJson(fileName: string): Promise<any> {
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

/**
 * ConfigHelper loads an arbitrary JSON config
 * from a file
 */
export class JsonFileHelper implements ConfigHelper {
    private _fileName;
    private _lazy = new LazyThing<any>(
        () => loadJson(this._fileName),
    );

    constructor(fileName) {
        this._fileName = fileName;
    }

    public loadConfig(fileName?: string): Promise<any> {
        if ((!fileName) || (fileName == this._fileName)) {
            return this._lazy.getThing();
        }
        return loadJson(fileName);
    }
}
