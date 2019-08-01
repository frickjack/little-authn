import {lambdaHandler} from '../lambdaBridge.js';

describe('the authn lambdaBridge', function() {
    it('can say hello', function(done) {
        lambdaHandler({path:'/whatever'}, {}).then(
            (response) => {
                expect(response.body).toBeDefined();
                const body = JSON.parse(response.body);
                expect(body.message).toBe('hello, world');
                done();
            },
            (err) => {
                done.fail('lambda bridge failed?');
            }
        );
    });
});
