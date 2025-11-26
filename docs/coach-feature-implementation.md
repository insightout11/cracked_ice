# Fantasy Hockey AI Coach - Complete Implementation

## Overview

The AI Coach feature allows users to upload screenshots of their fantasy hockey league settings, roster, and free agent lists. The system uses OpenAI's GPT-4 Vision to read the images, analyze schedule conflicts, and provide personalized recommendations using weighted scoring projections.

## Key Features

1. **Image Upload & OCR**: Upload screenshots, AI reads them automatically
2. **Weighted Scoring**: 50% season, 30% last 30 days, 20% last 7 days
3. **Schedule Conflict Analysis**: Identifies when good players will be benched
4. **AI Recommendations**: Smart suggestions based on projections and schedule fit
5. **Conversational AI Chat**: Ask questions, get explanations in real-time
6. **Clean UI**: Single-page collapsible interface, no clutter

## Architecture

### Backend (Node.js/Express)

#### Scoring Engine
**File**: `server/src/features/coach/scoring.ts`
- Modified `lookupBlendedFppg()` to calculate: `(season * 0.5) + (last30 * 0.3) + (last7 * 0.2)`
- Uses nightly-updated stats from `server/data/stats.json`

#### OCR Service
**File**: `server/src/services/ocr.ts`
- `parseLeagueSettingsScreenshot()` - Extracts scoring weights and lineup slots
- `parseRosterScreenshot()` - Extracts player names, teams, positions
- `parseFreeAgentsScreenshot()` - Extracts free agent lists
- Uses GPT-4o Vision model
- Returns confidence scores and unmatched players for manual review

#### Upload Endpoints
**File**: `server/src/routes/coach.ts`
- `POST /coach/users/:userId/upload/league-settings`
- `POST /coach/users/:userId/upload/roster`
- `POST /coach/users/:userId/upload/free-agents`
- Accepts multipart/form-data
- Saves images to `server/data/uploads/:userId/` for audit
- Auto-matches player names using fuzzy search

#### AI Chat Endpoint
**File**: `server/src/routes/coach-chat.ts`
- `POST /coach/users/:userId/chat` - Streaming responses (SSE)
- `POST /coach/users/:userId/chat/simple` - Non-streaming version
- Context-aware: knows user's league, roster, current recommendations
- Answers questions like "Why drop X?", "Show me off-night players"

### Frontend (React/TypeScript)

#### Component Structure

1. **CoachAssistant** (`web/src/components/CoachAssistant.tsx`)
   - Main container component
   - Collapsible sections for each step
   - Auto-expands next section when current is complete
   - Manages state for all uploads and data

2. **ImageUploadZone** (`web/src/components/ImageUploadZone.tsx`)
   - Drag-and-drop file upload
   - Shows preview of uploaded image
   - Loading and completion states
   - Reusable for all three upload types

3. **CoachChat** (`web/src/components/CoachChat.tsx`)
   - Real-time streaming chat interface
   - Message history with user/assistant roles
   - Suggested questions based on setup status
   - Keyboard shortcuts (Enter to send, Shift+Enter for newline)

4. **ConflictDashboard** (`web/src/components/ConflictDashboard.tsx`)
   - Visual calendar showing daily lineup
   - Highlights benched players in red
   - Shows unused roster slots
   - Lists most frequently benched players

#### HomePage Update
**File**: `web/src/pages/HomePage.tsx`
- Added mode toggle: "Draft Helper" vs "AI Coach"
- Clean separation between draft analysis and coaching features
- Removed old cluttered panels (CoachSetupPanel, CoachStreamersOverlay, CoachPlayerSearchPanel)

#### API Service
**File**: `web/src/services/api.ts`
- `uploadLeagueSettingsImage()` - Upload settings screenshot
- `uploadRosterImage()` - Upload roster screenshot
- `uploadFreeAgentsImage()` - Upload free agents screenshot
- `sendChatMessage()` - Simple chat (non-streaming)
- `streamChatMessage()` - Async generator for streaming responses

## User Flow

### 1. Upload League Settings
- User uploads screenshot of scoring categories and lineup slots
- AI extracts:
  - League name
  - Scoring weights (goals, assists, SOG, blocks, PPP)
  - Lineup positions (C, LW, RW, F, D, G, BN, IR)
- Confidence score and warnings displayed

### 2. Upload Roster
- User uploads screenshot of their current roster
- AI extracts player names, teams, positions
- Auto-matches to player database using fuzzy search
- Shows matched players and any unmatched names

### 3. Upload Free Agents
- User uploads screenshot of available free agents
- AI extracts and matches players
- Optional: can skip if only analyzing current roster

### 4. View Schedule Conflicts
- Automatically analyzes upcoming games
- Shows days where players will be benched due to position limits
- Identifies most frequently benched players
- Displays unused roster slots

### 5. Get Recommendations
- Select time window (7 days, 14 days, or custom)
- Click "Get Recommendations"
- AI generates top 5+ recommendations ranked by:
  - Delta points (projected points gained)
  - Delta GP (additional games played)
  - Schedule fit (off-nights, avoiding conflicts)

### 6. Chat with AI
- Always-available chat interface at bottom
- Ask questions:
  - "Why should I drop X for Y?"
  - "Who has the best off-night schedule?"
  - "Show me players with back-to-backs"
- AI provides context-aware answers based on your specific league

## Setup & Configuration

### Environment Variables

Add to `.env`:
```bash
OPENAI_API_KEY=your-openai-api-key-here
VITE_COACH_USER_ID=demo  # Or your user ID
VITE_COACH_API_URL=http://localhost:8080/api  # Optional override
```

### Dependencies

**Backend**:
```bash
cd server
npm install openai multer @types/multer
```

**Frontend**:
No new dependencies needed (React, axios, existing packages)

### Running the Application

1. **Start Backend**:
```bash
cd server
npm start
```
Server runs on http://localhost:8080

2. **Start Frontend**:
```bash
cd web
npm run dev
```
Frontend runs on http://localhost:5173

3. **Access Application**:
- Go to http://localhost:5173
- Click "AI Coach" toggle
- Start uploading screenshots!

## Data Flow

### Nightly Stats Update
```
External API → server/data/stats.json
                ↓
            loadStats()
                ↓
        StatsContext (app.locals)
                ↓
        Scoring calculations
```

### User Upload Flow
```
User Screenshot → FormData → Multer → OpenAI Vision
                                            ↓
                                    OCR Parse Result
                                            ↓
                                    Fuzzy Match Players
                                            ↓
                            Save to server/data/coach/users/:userId/
                                            ↓
                                    Return to Frontend
```

### Recommendation Generation
```
User Data + Window → generateCoachRecommendations()
                            ↓
                    Build Projections (weighted scoring)
                            ↓
                    Simulate Lineups (each day)
                            ↓
                    Calculate Deltas
                            ↓
                    Rank & Return Top 5+
```

## Key Algorithms

### Weighted Scoring
```typescript
const weighted = (season * 0.5) + (last30 * 0.3) + (last7 * 0.2);
```

### Lineup Simulation
For each day in window:
1. Find all players with games that day
2. Sort by FPPG (projected points per game)
3. Fill lineup slots by position (highest FPPG first)
4. Mark remaining players as benched
5. Track conflicts and unused slots

### Recommendation Ranking
```typescript
recommendations.sort((a, b) =>
  b.delta_points - a.delta_points || b.delta_gp - a.delta_gp
);
```

## Badge System

- **Cyan (Off-night boost)**: ≥60% games on off-nights, positive GP delta
- **Blue (Ceiling play)**: ≥4 point gain, significantly better FPPG
- **Green (Volume stream)**: ≥2 additional games played
- **Red (Steady)**: Default badge

## Testing

### Manual Testing Checklist

1. **League Settings Upload**:
   - [ ] Upload clear screenshot
   - [ ] Verify scoring weights detected
   - [ ] Verify lineup slots detected
   - [ ] Check for warnings

2. **Roster Upload**:
   - [ ] Upload roster screenshot
   - [ ] Verify all players matched
   - [ ] Check unmatched list
   - [ ] Review detected teams/positions

3. **Free Agents Upload**:
   - [ ] Upload FA screenshot
   - [ ] Verify matching
   - [ ] Check unmatched list

4. **Conflict Analysis**:
   - [ ] Loads automatically after roster upload
   - [ ] Shows benched players
   - [ ] Shows daily breakdown
   - [ ] Calendar is accurate

5. **Recommendations**:
   - [ ] Select 7-day window
   - [ ] Click "Get Recommendations"
   - [ ] Verify baseline points
   - [ ] Review top recommendations
   - [ ] Check badges are appropriate

6. **AI Chat**:
   - [ ] Send basic question
   - [ ] Verify streaming response
   - [ ] Ask about specific player
   - [ ] Request schedule analysis
   - [ ] Check context awareness

## Troubleshooting

### Common Issues

**"OpenAI API key not configured"**
- Add `OPENAI_API_KEY` to `.env` file
- Restart server

**"Player directory unavailable"**
- Ensure `server/data/players.json` exists
- Run stats hydration script

**"Stats cache not found"**
- Ensure `server/data/stats.json` exists
- Run stats hydration script

**Image upload fails**
- Check file size < 10MB
- Ensure image is PNG/JPG
- Verify server has write permissions for `server/data/uploads/`

**Chat not streaming**
- Check browser console for errors
- Verify backend is running
- Test with `/chat/simple` endpoint first

**Bad recommendations**
- Verify stats.json is up to date
- Check that `blendedFppg` values look correct
- Review schedule data in `server/data/schedules-20252026.json`

## Future Enhancements

### Possible Improvements

1. **Multi-Move Optimization**
   - Currently finds best single swap
   - Could explore 2-3 move combinations

2. **Historical Tracking**
   - Save recommendation history
   - Track which suggestions were followed
   - Show accuracy metrics

3. **Advanced Filtering**
   - Filter by position
   - Filter by team
   - Filter by injury status
   - Filter by playoff schedule

4. **Export/Share**
   - Export recommendations as PDF
   - Share with league mates
   - Save preferred players list

5. **Additional Providers**
   - Anthropic Claude Vision (already stubbed)
   - Groq LLaVA (already stubbed)
   - Google Gemini Vision

6. **Mobile App**
   - Native camera integration
   - Push notifications for waivers
   - Quicker screenshot flow

## Performance Considerations

- **OCR Latency**: GPT-4 Vision takes 3-5 seconds per image
- **Recommendation Generation**: <1 second for typical roster (16 players, 50 FA)
- **Chat Streaming**: Starts responding in <500ms
- **Image Storage**: Screenshots stored indefinitely (consider cleanup policy)

## Security Notes

- User IDs are not authenticated (staging only)
- Images contain PII (player names, league names)
- OpenAI receives all uploaded images
- Consider adding authentication before production
- Rate limit uploads to prevent abuse

## Credits

Built with:
- OpenAI GPT-4o Vision for OCR
- OpenAI GPT-4o for conversational AI
- Express.js for backend
- React + TypeScript for frontend
- Tailwind CSS for styling

## License

Proprietary - All rights reserved
