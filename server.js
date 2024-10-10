var express = require('express');


var indexRouter = require('./index');

var app = express();

app.use('/', indexRouter);
app.use(express.static('public'));


const port = 3000;

 
app.listen(port, () => {
    console.log(`Server running at port:${port}`);
}); 
  
