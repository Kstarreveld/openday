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
  key: fs.readFileSync(process.env.PRVKEY),
  cert: fs.readFileSync(process.env.PUBKEY)
};

// Create an HTTPS service identical to the HTTP service.
https.createServer(options, app).listen(port,()=> 
{
    console.log(`Server started on port ${port}`);
});
