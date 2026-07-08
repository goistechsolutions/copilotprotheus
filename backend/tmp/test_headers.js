const http = require('http');
http.get('http://adminer:8080', res => {
  console.log("HEADERS:", res.headers);
});
