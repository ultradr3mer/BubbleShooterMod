const https = require('https');
const fs = require('fs');
var static = require('node-static');
const open = require('open');

var fileServer = new static.Server('.');
 
const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

var hostname = 'localhost';
var port = 8000;

https.createServer(options, function (request, response) {
    request.addListener('end', function () {
        fileServer.serve(request, response);
    }).resume();
}).listen(port, hostname, function() {
  console.log('Server running at https://'+ hostname + ':' + port + '/');
  open('https://' + hostname + ':' + port + '/games.softgames.com/games/bubble-shooter-hd/gamesites/1964/locale/de/index.htm');
});