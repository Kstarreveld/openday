var express = require('express');
var https = require('https');
var fs = require('fs');
var app = express();

var indexRouter = require('./index');

app.use('/', indexRouter);
app.use(express.static('public'));


const port = 3000;

 /*
app.listen(port, () => {
    console.log(`Server running at port:${port}`);
}); 
  */

// This line is from the Node.js HTTPS documentation.
var options = {
  key: fs.readFileSync('test/fixtures/keys/agent2-key.pem'),
  cert: fs.readFileSync('test/fixtures/keys/agent2-cert.cert')
};

// Create an HTTPS service identical to the HTTP service.
https.createServer(options, app).listen(port,()=> 
{
    console.log(`Server started on port ${port}`);
});
