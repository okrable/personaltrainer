const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";
const CHAT_PATH = "/chat/completions";

const buildPrompt = ({ goal, plan, summary, preferences, preferredQualityType }) => `
You are an elite distance running coach writing workouts in a Runna-like style.
Create two options for today: an easy option and a quality option.
Use evidence-based training progression, avoid unsafe load spikes, and match the session to time availability.

Goal: ${goal}
Plan timing: ${plan}
Preferences: ${preferences}
Preferred quality type for today: ${preferredQualityType}

Recent training summary from Strava:
- Weekly average: ${summary.weeklyAverageKm} km
- Recent runs: ${summary.recentRuns}
- Quality sessions: ${summary.qualityCount} (last ${summary.lastQualityDays} days ago)
- Elevation in last 6 weeks: ${summary.totalElevationM} m
- Weekly distances: ${summary.weeklyDistancesKm.join(", ")} km
- Average pace over 6 weeks: ${summary.averagePaceMinKm ?? "N/A"} min/km
- Fastest recent pace: ${summary.fastestPaceMinKm ?? "N/A"} min/km

Rules:
- The quality option MUST match today's preferred quality type: ${preferredQualityType}.
- Easy option rules:
  - Keep it to one simple prescription only.
  - No intervals, no reps, no target pace, and no RPE.
  - Use conversational pace wording only.
  - segments should be empty or contain only one simple conversational segment.
  - Determine easy-run distance from the Strava summary (weekly distance trends and recent load should size the distance).
- Quality option rules:
  - Use a clear warm-up / main set / cool-down structure.
  - Include structured segments with target pace and effort ranges where needed.
- If weekly load is high or last quality session was <2 days ago, reduce intensity and volume.

Output in JSON only, no markdown, using exactly this schema:
{
  "easy_option": {
    "title": "...",
    "distance_km": 8,
    "details": "Single-sentence conversational easy run prescription with no pace numbers",
    "segments": []
  },
  "quality_option": {
    "title": "...",
    "target_pace": "... min/km or range",
    "rpe": "6-9",
    "details": "Short summary sentence",
    "segments": [
      {
        "name": "Warm-up",
        "instruction": "...",
        "target_pace": "... min/km",
        "rpe": "2-3",
        "workout_type": "RUN"
      },
      {
        "name": "Intervals",
        "instruction": "...",
        "target_pace": "... min/km",
        "rpe": "7-8",
        "repeat": 6,
        "workout_type": "RUN"
      },
      {
        "name": "Cool down",
        "instruction": "...",
        "target_pace": "... min/km",
        "rpe": "2-3",
        "workout_type": "RUN"
      }
    ]
  },
  "reasoning": ["...", "...", "..."],
  "warnings": ["..."]
}
`.trim();

const fallbackWorkout = ({ summary, preferredQualityType }) => {
  const qualityLibrary = {
    intervals: {
      title: "Interval development session",
      target_pace: "4:35-4:50 min/km",
      rpe: "7-8",
      details: "Structured interval day with clear warm-up, reps, and cool down pacing.",
      segments: [
        {
          name: "Warm-up",
          instruction: "2 km easy jog with 4 x 20s relaxed strides",
          target_pace: "5:45-6:05 min/km",
          rpe: "2-3",
          workout_type: "RUN",
        },
        {
          name: "Intervals",
          instruction: "800 m strong, 400 m easy jog recovery",
          target_pace: "4:35-4:50 min/km",
          rpe: "7-8",
          repeat: 5,
          workout_type: "RUN",
        },
        {
          name: "Cool down",
          instruction: "1.5 km easy jog",
          target_pace: "5:55-6:20 min/km",
          rpe: "2-3",
          workout_type: "RUN",
        },
      ],
    },
    tempo: {
      title: "Tempo control session",
      target_pace: "4:55-5:05 min/km",
      rpe: "6-7",
      details: "Tempo-focused work with clear pace targets for each block.",
      segments: [
        {
          name: "Warm-up",
          instruction: "15 min easy jog and mobility drills",
          target_pace: "5:45-6:05 min/km",
          rpe: "2-3",
          workout_type: "RUN",
        },
        {
          name: "Tempo reps",
          instruction: "8 min tempo with 2 min easy jog recovery",
          target_pace: "4:55-5:05 min/km",
          rpe: "6-7",
          repeat: 4,
          workout_type: "RUN",
        },
        {
          name: "Cool down",
          instruction: "10 min easy jog",
          target_pace: "5:55-6:20 min/km",
          rpe: "2-3",
          workout_type: "RUN",
        },
      ],
    },
    "long run": {
      title: "Progressive long run",
      target_pace: "5:25-5:50 min/km",
      rpe: "4-6",
      details: "Long run progression with clear pacing from start to finish.",
      segments: [
        {
          name: "Settle in",
          instruction: "40 min comfortable aerobic running",
          target_pace: "5:40-5:55 min/km",
          rpe: "4",
          workout_type: "RUN",
        },
        {
          name: "Steady block",
          instruction: "25 min steady effort",
          target_pace: "5:20-5:35 min/km",
          rpe: "5",
          workout_type: "RUN",
        },
        {
          name: "Controlled finish",
          instruction: "10 min strong but controlled",
          target_pace: "5:05-5:15 min/km",
          rpe: "6",
          workout_type: "RUN",
        },
      ],
    },
  };

  return {
    easy_option: {
      title: "Easy aerobic run",
      target_pace: "5:35-5:55 min/km",
      rpe: "2-4",
      details: "Easy run with explicit pacing for warm-up, main set, and cool down.",
      segments: [
        {
          name: "Warm-up",
          instruction: "10 min relaxed jog",
          target_pace: "5:50-6:10 min/km",
          rpe: "2-3",
          workout_type: "RUN",
        },
        {
          name: "Main run",
          instruction: "35 min conversational running",
          target_pace: "5:35-5:55 min/km",
          rpe: "3-4",
          workout_type: "RUN",
        },
        {
          name: "Cool down",
          instruction: "8 min easy jog",
          target_pace: "5:55-6:20 min/km",
          rpe: "2-3",
          workout_type: "RUN",
        },
      ],
    },
    quality_option: qualityLibrary[preferredQualityType] || qualityLibrary.tempo,
    reasoning: [
      `Weekly average is ${summary.weeklyAverageKm} km, so a controlled quality day is appropriate.`,
      `Today's preferred quality type is ${preferredQualityType}, and the session follows that structure.`,
      "Segment-level pace guidance is included so effort is clear throughout the workout.",
    ],
    warnings: [],
  };
};

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const { goal, plan, summary, preferences, preferredQualityType = "tempo" } = body;

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
          workout: fallbackWorkout({ summary, preferredQualityType }),
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
            content: buildPrompt({ goal, plan, summary, preferences, preferredQualityType }),
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
      workout = fallbackWorkout({ summary, preferredQualityType });
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
