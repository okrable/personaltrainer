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
- Every segment must have a specific target pace and an effort range.
- Use a clear segment structure so the athlete always knows exactly how hard to run at each point.
- If weekly load is high or last quality session was <2 days ago, reduce intensity and volume.

Output in JSON only, no markdown, using exactly this schema:
{
  "easy_option": {
    "title": "...",
    "target_pace": "... min/km",
    "rpe": "2-4",
    "details": "Short summary sentence",
    "segments": [
      {
        "name": "Warm-up",
        "instruction": "...",
        "target_pace": "... min/km",
        "rpe": "2-3",
        "workout_type": "RUN"
      }
    ]
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

const computeFallbackEasyDistanceKm = (summary) => {
  const weeklyAverageKm = Number(summary.weeklyAverageKm) || 0;
  const weeklyDistances = Array.isArray(summary.weeklyDistancesKm)
    ? summary.weeklyDistancesKm.filter((distance) => Number.isFinite(Number(distance))).map(Number)
    : [];
  const lastQualityDays = Number(summary.lastQualityDays);

  const recentWeekKm = weeklyDistances.length ? weeklyDistances[weeklyDistances.length - 1] : weeklyAverageKm;
  const priorWeekKm = weeklyDistances.length > 1 ? weeklyDistances[weeklyDistances.length - 2] : recentWeekKm;
  const trendRatio = priorWeekKm > 0 ? recentWeekKm / priorWeekKm : 1;

  // Typical easy day is around 20-30% of weekly load, then tuned by recovery and trend.
  const baseDistanceKm = Math.max(5, weeklyAverageKm * 0.24);
  const recoveryAdjustment =
    Number.isFinite(lastQualityDays) && lastQualityDays <= 1
      ? 0.85
      : Number.isFinite(lastQualityDays) && lastQualityDays >= 4
        ? 1.08
        : 1;
  const trendAdjustment = trendRatio >= 1.15 ? 0.92 : trendRatio <= 0.9 ? 1.05 : 1;

  const adjustedDistanceKm = baseDistanceKm * recoveryAdjustment * trendAdjustment;
  return Math.min(18, Math.max(5, Math.round(adjustedDistanceKm * 2) / 2));
};

const fallbackWorkout = ({ summary, preferredQualityType }) => {
  const weeklyDistancesText = Array.isArray(summary.weeklyDistancesKm)
    ? summary.weeklyDistancesKm.join(", ")
    : "N/A";
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

  const easyDistanceKm = computeFallbackEasyDistanceKm(summary);

  return {
    easy_option: {
      title: "Easy aerobic run",
      details: `Run ${easyDistanceKm} km at conversational pace.`,
      segments: [
        {
          name: "Easy run",
          instruction: `Run ${easyDistanceKm} km at conversational pace.`,
          workout_type: "RUN",
        },
      ],
    },
    quality_option: qualityLibrary[preferredQualityType] || qualityLibrary.tempo,
    reasoning: [
      `Easy distance is set to ${easyDistanceKm} km using your weekly average (${summary.weeklyAverageKm} km) and recent weekly trend (${weeklyDistancesText} km).`,
      `Recovery was adjusted using last quality timing (${summary.lastQualityDays} days ago), so today's easy load matches current freshness.`,
      `Today's preferred quality type is ${preferredQualityType}, and the session follows that structure.`,
      "Easy day guidance is intentionally simple: one conversational-pace instruction without extra pace or interval structure.",
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
