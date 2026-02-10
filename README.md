# Personal Trainer Planner

A React-based planner that suggests daily run workouts based on your race goal, training load, and time-to-race.

## Available Scripts

In the project directory, you can run:

### `npm run dev`

Starts the Vite development server.

### `npm run build`

Builds the app for production into the `dist/` directory.

### `npm run preview`

Serves the production build locally for a final check.

## Environment variables

Create a `.env` file locally (or configure Netlify environment variables) with:

```
STRAVA_CLIENT_ID=...
STRAVA_CLIENT_SECRET=...
STRAVA_REFRESH_TOKEN=...
GROQ_API_KEY=...
GROQ_MODEL=llama-3.1-8b-instant
GROQ_BASE_URL=https://api.groq.com/openai/v1
```

The Strava variables power the `/netlify/functions/strava-history` endpoint, and the Groq
variables enable AI-generated workouts via `/netlify/functions/ai-workout`.


## Input reference

See `GUIDE-README.md` for a detailed explanation of every field in the plan settings modal.
