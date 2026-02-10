const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";
const CHAT_PATH = "/chat/completions";

const buildPrompt = ({ goal, plan, summary, preferences }) => `
You are an elite distance running coach writing workouts in a Runna-like style.
Create two options for today: an easy option and a quality option.
Use evidence-based training progression, avoid unsafe load spikes, and match the session to time availability.

Goal: ${goal}
Plan timing: ${plan}
Preferences: ${preferences}

Recent training summary from Strava:
- Weekly average: ${summary.weeklyAverageKm} km
- Recent runs: ${summary.recentRuns}
- Quality sessions: ${summary.qualityCount} (last ${summary.lastQualityDays} days ago)
- Elevation in last 6 weeks: ${summary.totalElevationM} m
- Weekly distances: ${summary.weeklyDistancesKm.join(", ")} km
- Average pace over 6 weeks: ${summary.averagePaceMinKm ?? "N/A"} min/km
- Fastest recent pace: ${summary.fastestPaceMinKm ?? "N/A"} min/km

Pace guidance rules:
- Easy pace should usually be ~8-18% slower than average pace and feel conversational (RPE 2-4).
- Tempo/threshold reps should usually be between average pace and up to 8% faster, based on fatigue.
- Faster interval reps can be up to ~12-20% faster than average pace, but only if load is manageable.
- If weekly load is high or last quality session was <2 days ago, reduce intensity and volume.

Output in JSON only, no markdown, using exactly this schema:
{
  "easy_option": {
    "title": "...",
    "target_pace": "... min/km",
    "rpe": "2-4",
    "details": "Runna-like workout format with warm-up/main/cool-down where relevant"
  },
  "quality_option": {
    "title": "...",
    "target_pace": "... min/km or range",
    "rpe": "6-9",
    "details": "Runna-like workout format with warm-up/main/cool-down and recoveries"
  },
  "reasoning": ["...", "...", "..."],
  "warnings": ["..."]
}

Good quality examples:
1) Easy progression:
"10 min warm up, 35 min easy @ 5:35-5:55/km (RPE 3), 4 x 20s relaxed strides, 8 min cool down"
2) Hill quality:
"2 km warm up, 10 x 60s uphill @ RPE 8 (jog down recovery), 10 min cool down"
3) Tempo quality:
"15 min warm up, 4 x 8 min @ 4:55-5:05/km (2 min easy jog), 10 min cool down"
`.trim();

const fallbackWorkout = ({ summary }) => ({
  easy_option: {
    title: "Easy aerobic run",
    target_pace: "5:35-5:55 min/km",
    rpe: "2-4",
    details: "10 min warm up, 35-45 min easy aerobic running, 5-10 min cool down.",
  },
  quality_option: {
    title: "Progressive tempo",
    target_pace: "4:55-5:10 min/km",
    rpe: "6-7",
    details: "15 min warm up, 3 x 8 min tempo (2 min easy jog), 10 min cool down.",
  },
  reasoning: [
    `Weekly average is ${summary.weeklyAverageKm} km, so a moderate session fits the load.`,
    "Quality option builds sustained fitness without sharp spikes.",
  ],
  warnings: [],
});

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const { goal, plan, summary, preferences } = body;

    if (!goal || !plan || !summary) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required inputs." }),
      };
    }

    if (!process.env.GROQ_API_KEY) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          workout: fallbackWorkout({ summary }),
          source: "fallback",
        }),
      };
    }

    const baseUrl = process.env.GROQ_BASE_URL || DEFAULT_BASE_URL;
    const response = await fetch(`${baseUrl}${CHAT_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: "You are a running coach and exercise scientist.",
          },
          {
            role: "user",
            content: buildPrompt({ goal, plan, summary, preferences }),
          },
        ],
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: text }),
      };
    }

    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content || "";
    let workout;

    try {
      workout = JSON.parse(content);
    } catch (error) {
      workout = fallbackWorkout({ summary });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ workout, source: "groq" }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
