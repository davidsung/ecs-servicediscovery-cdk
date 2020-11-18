const http = require('http');
const express = require('express');

const app = express();

app.get('/', (req, res) => {
  res.json({time: Date.now()});
});

const server = http.createServer(app);

server.listen(3000);
