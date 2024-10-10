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

const readFileContent = filePath => {
    try {
        return fs.readFileSync(filePath, 'utf8').trim();
    } 
    catch (err) {
        console.error("Error:", err);
    }
}

// Replace 'your-file.txt' with the path to the file you want to read
var folder = readFileContent(process.env.CERTFOLDER + "DEFAULT");

var options = {
  key: fs.readFileSync(process.env.CERTFOLDER + folder + "/" + process.env.PRVKEYFILE),
  cert: fs.readFileSync(process.env.CERTFOLDER + folder + "/" + process.env.PUBKEYFILE)
};

// Create an HTTPS service identical to the HTTP service.
https.createServer(options, app).listen(port,()=> 
{
    console.log(`Server started on port ${port}`);
});
