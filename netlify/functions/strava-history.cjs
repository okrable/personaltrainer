const STRAVA_TOKEN_URL = "https://www.strava.com/api/v3/oauth/token";
const STRAVA_ACTIVITIES_URL = "https://www.strava.com/api/v3/athlete/activities";

const getAccessToken = async () => {
  const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN } = process.env;
  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET || !STRAVA_REFRESH_TOKEN) {
    throw new Error("Missing Strava credentials.");
  }

  const response = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      refresh_token: STRAVA_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Strava token error: ${text}`);
  }

  const payload = await response.json();
  return payload.access_token;
};

const buildSummary = (activities) => {
  const runs = activities.filter((activity) => activity.type === "Run");
  const now = Date.now();
  const weeklyBuckets = new Map();
  let totalDistance = 0;
  let totalElevation = 0;
  let qualityCount = 0;
  let lastQualityDays = null;

  runs.forEach((activity) => {
    totalDistance += activity.distance || 0;
    totalElevation += activity.total_elevation_gain || 0;

    const start = new Date(activity.start_date).getTime();
    const weekKey = Math.floor((now - start) / (7 * 24 * 60 * 60 * 1000));
    weeklyBuckets.set(weekKey, (weeklyBuckets.get(weekKey) || 0) + (activity.distance || 0));

    const averageSpeed = activity.average_speed || 0;
    const isQuality = activity.workout_type === 1 || averageSpeed >= 3.8;
    if (isQuality) {
      qualityCount += 1;
      const daysAgo = Math.floor((now - start) / (24 * 60 * 60 * 1000));
      if (lastQualityDays === null || daysAgo < lastQualityDays) {
        lastQualityDays = daysAgo;
      }
    }
  });

  const weeklyDistances = Array.from(weeklyBuckets.entries())
    .sort((a, b) => a[0] - b[0])
    .slice(0, 6)
    .map(([, distance]) => distance / 1000);
  const weeklyAverage =
    weeklyDistances.reduce((sum, value) => sum + value, 0) /
    (weeklyDistances.length || 1);

  return {
    totalDistanceKm: Number((totalDistance / 1000).toFixed(1)),
    totalElevationM: Math.round(totalElevation),
    weeklyAverageKm: Number(weeklyAverage.toFixed(1)),
    recentRuns: runs.length,
    qualityCount,
    lastQualityDays: lastQualityDays ?? "N/A",
    weeklyDistancesKm: weeklyDistances.map((value) => Number(value.toFixed(1))),
  };
};

exports.handler = async () => {
  try {
    const accessToken = await getAccessToken();
    const after = Math.floor((Date.now() - 42 * 24 * 60 * 60 * 1000) / 1000);
    const response = await fetch(
      `${STRAVA_ACTIVITIES_URL}?per_page=60&after=${after}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: text }),
      };
    }

    const activities = await response.json();
    const summary = buildSummary(activities);

    return {
      statusCode: 200,
      body: JSON.stringify({ summary, activitiesCount: activities.length }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
