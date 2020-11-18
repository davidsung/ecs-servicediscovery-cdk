const http = require('http')

const options = {
  hostname: process.env.HEALTHCHECK_HOSTNAME,
  port: process.env.HEALTHCHECK_PORT,
  path: '/',
  method: 'GET'
};

exports.handler = async function(event) {
  const promise = new Promise(function(resolve, reject) {
    http.get(options, (res) => {
        var body = [];
        res.on('data', function(chunk) {
            body.push(chunk);
        });
        res.on('end', function() {
            try {
                body = JSON.parse(Buffer.concat(body).toString());
            } catch(e) {
                reject(e);
                return;
            }
            resolve(body);
        });
      }).on('error', (e) => {
        reject(Error(e))
      })
    })
  return promise
}
