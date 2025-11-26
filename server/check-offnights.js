const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/schedule.json', 'utf8'));

// Check Nov 19-26
const dates = {};
for (const [team, games] of Object.entries(data.teams)) {
  games.forEach(g => {
    if (g.date >= '2025-11-19' && g.date <= '2025-11-26') {
      if (!dates[g.date]) dates[g.date] = {teams: [], offNights: 0, total: 0};
      dates[g.date].teams.push({team, offNight: g.isOffNight});
      dates[g.date].total++;
      if (g.isOffNight) dates[g.date].offNights++;
    }
  });
}

console.log(JSON.stringify(dates, null, 2));
