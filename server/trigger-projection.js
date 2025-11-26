const http = require('http');
const postData = JSON.stringify({
  "window": {
    "start": "2025-01-06",
    "end": "2025-01-12"
  },
  "league": {
    "league_name": "Test",
    "scoring_type": "points",
    "lineup_slots": {"C": 2, "LW": 2, "RW": 2, "D": 4, "G": 2, "UTIL": 2, "BN": 4},
    "skater_scoring": {"goals": 6, "assists": 4},
    "goalie_scoring": {"wins": 4}
  },
  "roster": [{"playerId": "nhl:8479337", "slot": "RW"}]
});

const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/api/coach/users/demo-user/projections',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': postData.length
  }
};

const req = http.request(options, (res) => {
  res.on('data', () => {});
  res.on('end', () => console.log('Projection requested'));
});

req.on('error', (e) => console.error(e));
req.write(postData);
req.end();
