# Off-Night Optimizer

A fantasy hockey prototype that helps users find players whose game days least overlap with their current centers, maximizing starts in 2C lineups when they roster 3–4 centers.

## 🏒 Concept

**Problem**: In fantasy hockey (Yahoo), managers often have 2 C starting slots but roster 3–4 centers. Star centers share many heavy slate days, causing benchable points.

**Solution**: Draft/trade for centers whose teams play on different days than your star (e.g., McDavid/EDM). Compute team-pair Complement Scores and show Added Starts vs your current roster.

## ⚡ Features

### MVP Features
- **Complement Finder**: Given a seed team (e.g., EDM), compute a Complement Score for every other NHL team
- **Team Rankings**: Rank teams by complement score (raw + weighted for off-nights)
- **Mock Player Data**: For top complement teams, show mock centers with placeholder projections
- **Roster-Aware Mode**: Accept a list of center teams and compute Added Starts for candidates

### Core Algorithms
- **Complement Score**: `|D_T \ E|` where E = seed team dates, D_T = other team dates
- **Weighted Off-Nights**: Monday/Wednesday/Friday/Sunday get 1.2x weight (lighter slates)
- **Added Starts**: `|D_candidate \ ⋃ D_rosteredCenters|` for roster-aware analysis

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation & Setup

```bash
# Clone and install dependencies
git clone <repository-url>
cd fantasy-hockey
npm run install:all

# Start development servers
npm run dev
```

This will start:
- Backend server on http://localhost:3001
- Frontend dev server on http://localhost:3000

### Environment Setup

```bash
# Copy environment file
cp server/.env.example server/.env
```

## 📁 Project Structure

```
fantasy-hockey/
├── server/          # Node.js + Express backend
│   ├── src/
│   │   ├── services/    # NHL API client
│   │   ├── routes/      # API endpoints  
│   │   ├── utils/       # Complement engine
│   │   └── types/       # TypeScript definitions
│   └── package.json
├── web/             # React + Vite frontend  
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── services/    # API service layer
│   │   └── types/       # TypeScript definitions
│   └── package.json
└── package.json     # Root workspace config
```

## 🔌 API Endpoints

### GET `/api/teams`
Returns list of NHL teams with IDs and names.

### GET `/api/complement`
Calculate complement scores for all teams vs a seed team.

**Query Parameters:**
- `seedTeamId` (required): Team ID for comparison
- `start` (optional): Start date (YYYY-MM-DD)  
- `end` (optional): End date (YYYY-MM-DD)

**Response:**
```json
[
  {
    "teamId": 1,
    "teamName": "New Jersey Devils", 
    "abbreviation": "NJD",
    "complement": 45,
    "weightedComplement": 52.4,
    "datesComplement": ["2024-01-15", "2024-01-17", ...]
  }
]
```

### POST `/api/added-starts`
Calculate added starts for a candidate team vs rostered centers.

**Request Body:**
```json
{
  "seedCenterTeamIds": [22, 6, 12],
  "candidateTeamId": 1,
  "window": "14d"
}
```

## 🎮 Usage

### Complement Finder
1. Select your seed team (defaults to Edmonton Oilers)
2. View ranked teams by complement score
3. Click on teams to see mock center prospects

### Roster-Aware Tester  
1. Add your current center teams (up to 4)
2. Select a candidate team to evaluate
3. Choose time window (7d/14d/season)
4. See how many additional starts the candidate would provide

## 🧪 Testing

```bash
# Run all tests
npm test

# Run server tests only
npm run test:server

# Run client tests only  
npm run test:client
```

## 🔮 Data Sources

- **NHL Schedules**: NHL Stats API (public)
  - `GET https://statsapi.web.nhl.com/api/v1/teams`
  - `GET https://statsapi.web.nhl.com/api/v1/schedule?teamId={id}&startDate={date}&endDate={date}`

- **Yahoo Fantasy** (future): OAuth2 integration for real roster data

## 📈 Algorithm Details

### Complement Score Calculation
```typescript
E = dates(seedTeam)
for each team T != seed:
  D = dates(T)  
  complement = |D \ E|
  weighted = sum(weight[d] for d in (D \ E))
sort by weighted desc
```

### Off-Night Weights
- Monday, Wednesday, Friday, Sunday: 1.2x (lighter slates)
- Tuesday, Thursday, Saturday: 1.0x (heavier slates)

### Roster-Aware Added Starts
```typescript
Occupied = ⋃ dates(team of each rostered C)
AddedStarts(candidateTeam) = |dates(candidateTeam) \ Occupied|
```

## 🛠 Development Scripts

```bash
npm run dev          # Start both servers in development
npm run build        # Build both client and server
npm run start        # Start production server
npm test             # Run all tests
npm run lint         # Lint all code
```

## 🎯 Next Steps

### Immediate Enhancements
- Real player data integration
- Position eligibility (C/W dual-eligible)
- Public projections API integration
- CSV export functionality

### Yahoo Integration
- OAuth2 authentication
- League settings import  
- Real roster sync
- Live lineup optimization

### Advanced Features
- Weekly streamer recommendations
- Lineup cap constraints
- Multi-position analysis
- Historical performance data

## 🤝 Contributing

This is a prototype built for demonstration. Feel free to fork and extend with:
- Real projection data sources
- Additional fantasy platforms (ESPN, etc.)
- Mobile-responsive improvements
- Performance optimizations

## 📄 License

MIT License - see LICENSE file for details.