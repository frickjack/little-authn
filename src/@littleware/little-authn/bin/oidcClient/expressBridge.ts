import { Router } from 'express';
import { lambdaHandler } from './lambdaBridge.js';


/**
 * Async router factory suitable for little-server
 */
export function expressRouter(): Promise<Router> { 
    const router = Router();

    router.get('/', (req, res) => {
        return lambdaHandler(
            { body: req.body }, {}
        ).then(
            (response) => {
                res.set(response.headers);
                res.send(response.body);
            }
        );
    });
    return Promise.resolve(router);
}
