# Cracked Ice plugin for ChatGPT

The submission package for the ChatGPT plugin directory. The plugin itself is the MCP server at
`https://www.crackedicehockey.com/mcp` (`api/mcp.ts`, tools in `api/_lib/mcp-server.ts`): six
read-only NHL schedule tools, public data only, no sign-in.

```
chatgpt-plugin/
  plugin.json      manifest: listing text, links, review test cases, countries
  mcp.json         points at the MCP server
  assets/logo.png  512x512 logo (rendered from web/public/logo-mark.svg)
  assets/logo.svg  composer icon
```

The upload is a ZIP of these files with `plugin.json` at the top level (not this README).

## Submitting (Matt's OpenAI account)

1. **Verify yourself.** In the OpenAI platform, organization settings: complete individual
   verification (or business, if you'd rather list as Cracked Ice Hockey).
2. **Test it in ChatGPT first (developer mode).** In ChatGPT settings, turn on developer mode
   and add a connector with the URL `https://www.crackedicehockey.com/mcp` (no authentication).
   Ask the three default prompts and check the answers.
3. **Record the demo** (2 to 3 minutes; script below) and upload it somewhere with a public
   link, such as unlisted YouTube. Put the link in `demo_recording_url` in `plugin.json`.
4. **Start the submission** in the plugin dashboard and upload the ZIP.
5. **Domain verification.** The dashboard gives a challenge token. In Vercel → cracked-ice-web
   → Settings → Environment Variables, add `OPENAI_APPS_CHALLENGE` with that token (Production),
   then redeploy. Check that `https://www.crackedicehockey.com/.well-known/openai-apps-challenge`
   shows the token and nothing else, then click verify.
6. **Pick the category** in the dashboard if "Sports" isn't accepted as written.
7. **Resolve any automated findings**, confirm the policy attestations, and submit.

## Demo video script

Screen recording of ChatGPT with the connector added. Keep it plain; reviewers want to see each
tool work.

1. "Which nights are NHL off-nights this week, and which teams play 4 games?" Show the answer
   and point out the off-night counts and the link to the site.
2. "Who has the best NHL schedule to stream over the next two weeks?"
3. "When do the Vancouver Canucks play over the next 10 days?" Point out the Eastern start times.
4. "Which team's schedule pairs best with Vancouver for the next two weeks?"
5. "Which NHL teams have the best fantasy playoff schedule?"
6. Paste a roster: "Check my fantasy hockey roster for this week: Quinn Hughes, Connor McDavid,
   Leon Draisaitl, Elias Pettersson (VAN, C), Nikita Kucherov, Cale Makar, Igor Shesterkin,
   Thatcher Demko." Show the crowded nights and the room-to-stream nights.
7. Show one limit: "Who's on the waiver wire in my Yahoo league?" ChatGPT should say the plugin
   can't see leagues.

## Keeping it current

- The data refreshes nightly with the site; nothing to do.
- Changing a tool's name, inputs or descriptions changes what ChatGPT sees: bump `version` and
  resubmit if the directory asks for it.
- Next season: `config/season.json` drives the dates; update the test-case wording if it
  mentions this season.
