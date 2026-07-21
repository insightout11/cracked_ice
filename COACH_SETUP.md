# AI Coach Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
# Backend
cd server
npm install openai multer @types/multer

# Frontend (no new dependencies needed)
cd web
npm install
```

### 2. Configure Environment

Create/update `.env` file in project root:

```bash
# Required for OCR
OPENAI_API_KEY=sk-...your-key-here...

# Coach configuration
VITE_COACH_USER_ID=demo
NEXT_PUBLIC_ENV=staging
DISABLE_PROD=1

# Optional: Override API URL
# VITE_COACH_API_URL=http://localhost:8080/api
```

### 3. Start Services

```bash
# Terminal 1: Start backend
cd server
npm start
# Server runs on http://localhost:8080

# Terminal 2: Start frontend
cd web
npm run dev
# Frontend runs on http://localhost:5173
```

### 4. Test It Out

1. Go to http://localhost:5173
2. Click **"AI Coach"** toggle button
3. Upload a screenshot of your league settings
4. Upload a screenshot of your roster
5. Optionally upload free agents
6. View conflicts and get recommendations!

## What Screenshots to Upload

### League Settings Screenshot
Should show:
- League name
- Scoring categories (Goals, Assists, SOG, Blocks, PPP)
- Point values for each category
- Lineup positions (C, LW, RW, F, D, G, BN, IR)
- Number of slots for each position

**Example**: Screenshot of your league's "Settings" or "Scoring" page

### Roster Screenshot
Should show:
- All your current players (typically 16)
- Player names
- Teams (3-letter codes like EDM, TOR, BOS)
- Positions

**Example**: Screenshot of "My Team" or "Roster" page with full player list visible

### Free Agents Screenshot (Optional)
Should show:
- Available free agent players
- Names, teams, positions
- Can be top 20-50 available players

**Example**: Screenshot of "Free Agents" or "Available Players" page

## Tips for Best Results

### Screenshot Quality
- Use **clear, high-resolution** screenshots
- Ensure **text is readable**
- Include **full table headers** if possible
- Avoid partial/cropped player names

### OCR Accuracy
- GPT-4 Vision is very good but not perfect
- Review the "matched players" list after upload
- Check the "unmatched players" section
- You can manually correct via JSON upload if needed

### Recommendation Quality
- More free agents = better recommendations
- Upload 20-50 available FAs for best results
- Keep stats.json updated (nightly)
- Use realistic time windows (7-14 days)

## Chat Examples

Try asking the AI:

**Setup Questions**:
- "How do I get started?"
- "What information do you need?"
- "Can you explain how this works?"

**Player Questions**:
- "Why should I drop [Player Name]?"
- "Who has the best off-night schedule?"
- "Show me centers with back-to-backs"
- "Which player has more playoff games?"

**Strategy Questions**:
- "What's an off-night strategy?"
- "How do schedule conflicts work?"
- "Should I prioritize points or games played?"

## Troubleshooting

### "OpenAI API key not configured"
**Solution**: Add `OPENAI_API_KEY=sk-...` to your `.env` file and restart the server

### No players detected from screenshot
**Possible causes**:
- Image is blurry or low quality
- Text is too small
- Table is partially cut off

**Solution**: Take a clearer screenshot with full table visible

### Players not matching to database
**Possible causes**:
- Player name spelling differs from database
- Uncommon player not in our database
- OCR misread the name

**Solution**: Check "unmatched players" list and verify names. You can manually add via JSON if needed.

### Chat not responding
**Check**:
1. Backend is running (http://localhost:8080/health should return `{"ok":true}`)
2. Browser console for errors
3. OpenAI API key is valid
4. You have API credits remaining

### Recommendations seem wrong
**Check**:
1. Your league settings were detected correctly
2. Stats.json is up to date (should be regenerated nightly)
3. Schedule data is current
4. Time window is appropriate for your league stage

## File Locations

### Data Stored
- **User uploads**: `server/data/uploads/:userId/`
- **League settings**: `server/data/coach/users/:userId/settings.json`
- **Roster**: `server/data/coach/users/:userId/roster.json`
- **Free agents**: `server/data/coach/users/:userId/free_agents.json`

### Key Files
- **Stats cache**: `server/data/stats.json`
- **Schedule data**: `server/data/schedules-20262027.json` (filename tracks `config/season.json`)
- **Player directory**: `server/data/players.json`

## Development Notes

### Backend Architecture
- **Scoring weights**: `server/src/features/coach/scoring.ts` (line 66-85)
- **OCR service**: `server/src/services/ocr.ts`
- **Upload endpoints**: `server/src/routes/coach.ts` (lines 327-545)
- **Chat endpoint**: `server/src/routes/coach-chat.ts`

### Frontend Components
- **Main component**: `web/src/components/CoachAssistant.tsx`
- **Chat interface**: `web/src/components/CoachChat.tsx`
- **Upload zones**: `web/src/components/ImageUploadZone.tsx`
- **Conflict view**: `web/src/components/ConflictDashboard.tsx`

### API Methods
- **Service file**: `web/src/services/api.ts` (lines 162-282)
- **Type definitions**: `web/src/types/index.ts`

## Cost Estimates (OpenAI)

### GPT-4o Vision (OCR)
- ~$0.01-0.03 per image
- 3 images per user = ~$0.03-0.09

### GPT-4o (Chat)
- ~$0.01-0.02 per conversation
- Depends on context length

**Total per user**: ~$0.05-0.15 for complete setup + recommendations

## What's Next?

Once everything is working:

1. **Test with real data**: Use your actual league screenshots
2. **Verify accuracy**: Check that recommendations make sense
3. **Iterate on prompts**: Adjust OCR prompts in `ocr.ts` if needed
4. **Add authentication**: Before production, add user auth
5. **Monitor usage**: Track OpenAI API costs

## Getting Help

**Issues**:
- Check browser console (F12)
- Check backend logs
- Review `docs/coach-feature-implementation.md` for details

**Questions**:
- Ask the AI coach (it's pretty helpful!)
- Review the troubleshooting section above
- Check OpenAI API status

## Success Checklist

- [ ] Backend running on :8080
- [ ] Frontend running on :5173
- [ ] OpenAI API key configured
- [ ] Can toggle to "AI Coach" mode
- [ ] League settings upload works
- [ ] Roster upload works
- [ ] Conflicts display correctly
- [ ] Recommendations generate
- [ ] Chat responds to questions
- [ ] No console errors

**You're ready to optimize your fantasy hockey lineup! 🏒🤖**
