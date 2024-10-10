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
const fs = require('fs');

const readFileContent = filePath => fs.readFile(filePath, 'utf8', (err, data) => 
    err ? console.error("Error:", err) : console.log("File content:", data)
);

// Replace 'your-file.txt' with the path to the file you want to read
var folder = readFileContent(process.env.CERTFOLDER + "DEFAULT");

var options = {
  key: fs.readFileSync(process.env.CERTFOLDER + process.env.PRVKEYFILE),
  cert: fs.readFileSync(process.env.CERTFOLDER + process.env.PUBKEYFILE)
};

// Create an HTTPS service identical to the HTTP service.
https.createServer(options, app).listen(port,()=> 
{
    console.log(`Server started on port ${port}`);
});
