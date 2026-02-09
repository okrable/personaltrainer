const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const buildPrompt = ({ goal, plan, summary, preferences }) => `
You are a running coach. Use the athlete's context below to recommend two workout options
(easy + quality). Follow evidence-based training practices, avoid load spikes, and respect
time available. Provide clear workout details and a short rationale.

Goal: ${goal}
Plan timing: ${plan}
Preferences: ${preferences}

Recent training summary:
- Weekly average: ${summary.weeklyAverageKm} km
- Recent runs: ${summary.recentRuns}
- Quality sessions: ${summary.qualityCount} (last ${summary.lastQualityDays} days ago)
- Elevation in last 6 weeks: ${summary.totalElevationM} m
- Weekly distances: ${summary.weeklyDistancesKm.join(", ")} km

Return JSON with keys: easy_option, quality_option, reasoning, warnings.
`.trim();

const fallbackWorkout = ({ summary }) => ({
  easy_option: {
    title: "Easy aerobic run",
    details: `Run 45–60 minutes at conversational pace. Keep it relaxed and stop if legs feel heavy.`,
  },
  quality_option: {
    title: "Progressive tempo",
    details: "15 min easy + 3 x 6 min steady (2 min jog) + 10 min cool down.",
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

    if (!process.env.OPENAI_API_KEY) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          workout: fallbackWorkout({ summary }),
          source: "fallback",
        }),
      };
    }

    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
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
      body: JSON.stringify({ workout, source: "openai" }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
