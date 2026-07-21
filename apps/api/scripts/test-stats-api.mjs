import { SEASON_ID } from './_season.mjs';
const UA = 'cracked-ice/1.0 (+https://crackedicehockey.com)';

// Try different Stats REST API endpoints for goalie game logs
const goalieId = '8476432';
const season = SEASON_ID;

const urls = [
  `https://api.nhle.com/stats/rest/en/goalie/summary?isAggregate=false&isGame=true&start=0&limit=5&cayenneExp=playerId=${goalieId}%20and%20seasonId=${season}%20and%20gameTypeId=2`,
  `https://api.nhle.com/stats/rest/en/goalie/bios?cayenneExp=playerId=${goalieId}`,
  `https://api-web.nhle.com/v1/player/${goalieId}/landing`
];

for (const url of urls) {
  console.log(`\n\nTrying: ${url}`);
  try {
    const response = await fetch(url, { headers: { 'User-Agent': UA } });
    const text = await response.text();

    if (text.startsWith('<')) {
      console.log('  → Returned HTML (endpoint doesn\'t exist)');
    } else {
      const data = JSON.parse(text);
      console.log('  → Success! Keys:', Object.keys(data));
      if (data.data && Array.isArray(data.data)) {
        console.log('  → Found', data.data.length, 'records');
        if (data.data.length > 0) {
          console.log('  → First record keys:', Object.keys(data.data[0]));
        }
      }
    }
  } catch (err) {
    console.log('  → Error:', err.message);
  }
}
