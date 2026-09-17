require('dotenv').config();

const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');

const indexRouter = require('./index');

const app = express();
const port = process.env.PORT || 3000;
const certFolder = process.env.CERTFOLDER;
const privateKeyFile = process.env.PRVKEYFILE;
const publicKeyFile = process.env.PUBKEYFILE;

app.use(express.static(path.join(__dirname, 'public')));
app.use('/', indexRouter);

function loadHttpsOptions() {
  if (!certFolder || !privateKeyFile || !publicKeyFile) {
    return null;
  }

  const keyPath = path.join(certFolder, privateKeyFile);
  const certPath = path.join(certFolder, publicKeyFile);

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    return null;
  }

  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
}

const httpsOptions = loadHttpsOptions();

if (httpsOptions) {
  https.createServer(httpsOptions, app).listen(port, () => {
    console.log(`HTTPS server started on port ${port}`);
  });
}

const httpPort = httpsOptions ? Number(process.env.HTTP_PORT || port + 1) : port;
app.listen(httpPort, () => {
  console.log(`HTTP server started on port ${httpPort}`);
});
