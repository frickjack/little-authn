
/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Context doc: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html 
 * @param {Object} context
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 * 
 */
export const lambdaHandler = async (event, context) => {
    let response = {
        "isBase64Encoded": true, //|false,
        "statusCode": 200,
        "headers": { "Content-Type": "application/json; charset=utf-8" },
        //"multiValueHeaders": { "headerName": ["headerValue", "headerValue2", ...], ... },
        "body": JSON.stringify({
            message: 'hello world',
            // location: ret.data.trim()
        })
    };
    const subject = process.env['AUTHN_SUBJECT'] || 'world';
    try {
        // const ret = await axios(url);
        response = {
            "isBase64Encoded": true, //|false,
            "statusCode": 200,
            "headers": { "Content-Type": "application/json; charset=utf-8" },
            //"multiValueHeaders": { "headerName": ["headerValue", "headerValue2", ...], ... },
            "body": JSON.stringify({
                message: `hello, ${subject}`,
                path: event.path
                // location: ret.data.trim()
            })
        };
    } catch (err) {
        console.log(err);
        response.statusCode = 400;
        response.body = JSON.stringify(
            {
                message: 'error!'
            }
        );
    }

    return response
};
