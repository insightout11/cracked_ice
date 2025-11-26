const http = require('http');
http.get('http://localhost:8080/api/coach/users/demo-user/roster', (res) => {
  res.on('data', () => {});
  res.on('end', () => console.log('Request sent'));
}).on('error', (e) => console.error(e));
