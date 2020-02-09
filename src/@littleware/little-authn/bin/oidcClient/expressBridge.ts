import { Router } from "express";
import { lambdaHandler } from "./lambdaBridge.js";

/**
 * Async router factory suitable for little-server
 */
export function expressRouter(): Promise<Router> {
    const router = Router();

    router.all("*", (req, res) => {
        return lambdaHandler(
            {
                body: req.body,
                headers: req.headers,
                path: req.path,
                queryStringParameters: req.query,
            }, {},
        ).then(
            (response) => {
                res.status(response.statusCode);
                res.set(response.headers);
                res.send(response.body);
            },
        );
    });
    return Promise.resolve(router);
}
