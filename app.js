const https = require('https');
const fs = require('fs');
var static = require('node-static');

var fileServer = new static.Server('.');
 
const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

var hostname = '127.0.0.1';
var port = 8000;

server = https.createServer(options, function (request, response) {
    request.addListener('end', function () {
        fileServer.serve(request, response);
    }).resume();
}).listen(port, hostname, function() {
  console.log('Server running at https://'+ hostname + ':' + port + '/');
});