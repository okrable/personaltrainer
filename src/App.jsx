import { useEffect, useMemo, useState } from "react";
import "./App.css";

const phaseMap = [
  { name: "Foundation", range: [1, 4] },
  { name: "Build", range: [5, 10] },
  { name: "Peak", range: [11, 14] },
  { name: "Taper", range: [15, 16] },
];

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const getDefaultRaceDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 25);
  return date.toISOString().slice(0, 10);
};

const defaultSettings = {
  goalType: "Hilly trail marathon",
  raceDate: getDefaultRaceDate(),
  planLength: 16,
  weeklyDistance: 48,
  trainingLoad: "moderate",
  terrain: "mixed",
  timeAvailable: 60,
  lastQuality: 4,
  intervalDays: "monday,tuesday,wednesday",
  tempoDays: "wednesday,thursday,friday",
  longRunDays: "saturday,sunday",
};

const daysBetween = (start, end) =>
  Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

const getPhase = (week) =>
  phaseMap.find((phase) => week >= phase.range[0] && week <= phase.range[1])?.name || "Custom";

const getFocus = (inputs) => {
  if (inputs.trainingLoad === "high") return "Recovery emphasis";
  if (inputs.lastQuality >= 5) return "Quality session ready";
  return "Aerobic development";
};

const parseDayPreference = (value = "") =>
  value
    .split(",")
    .map((day) => day.trim().toLowerCase())
    .filter(Boolean);

const getPreferredWorkoutType = (settings, todayName) => {
  const day = todayName.toLowerCase();
  const intervalDays = parseDayPreference(settings.intervalDays);
  const tempoDays = parseDayPreference(settings.tempoDays);
  const longRunDays = parseDayPreference(settings.longRunDays);

  if (longRunDays.includes(day)) return "long run";
  if (tempoDays.includes(day)) return "tempo";
  if (intervalDays.includes(day)) return "intervals";
  return "tempo";
};

const deriveTrainingLoadFromStrava = (summary) => {
  if (!summary) return null;

  const distances = summary.weeklyDistancesKm || [];
  const latestWeek = distances[distances.length - 1] || 0;
  const averageWeek = summary.weeklyAverageKm || 0;
  const lastQualityDays = Number(summary.lastQualityDays);

  if (
    (averageWeek > 0 && latestWeek > averageWeek * 1.15) ||
    (Number.isFinite(lastQualityDays) && lastQualityDays <= 2) ||
    summary.qualityCount >= 3
  ) {
    return "high";
  }

  if ((averageWeek > 0 && latestWeek < averageWeek * 0.75) || summary.recentRuns <= 3) {
    return "low";
  }

  return "moderate";
};

const formatPaceTarget = (pace) => {
  if (!pace) return "By feel";
  return pace.replace(" min/km", "/km");
};

const getWorkoutTag = (title = "") => {
  const normalized = title.toLowerCase();
  if (normalized.includes("long")) return "Long run";
  if (normalized.includes("easy")) return "Easy run";
  if (normalized.includes("tempo") || normalized.includes("threshold")) return "Tempo";
  if (normalized.includes("interval")) return "Intervals";
  if (normalized.includes("hill")) return "Hills";
  return "Run";
};

const normalizeSegments = (option) => {
  if (Array.isArray(option?.segments) && option.segments.length > 0) {
    return option.segments;
  }

  return [
    {
      name: "Session",
      instruction: option?.details || "Follow this run as prescribed.",
      target_pace: option?.target_pace || "By feel",
      rpe: option?.rpe || "",
      workout_type: "RUN",
    },
  ];
};

const PlanApp = () => {
  const [settings, setSettings] = useState(defaultSettings);
  const [draft, setDraft] = useState(defaultSettings);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [stravaSummary, setStravaSummary] = useState(null);
  const [aiWorkout, setAiWorkout] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const hasStravaOverrides = Boolean(stravaSummary);

  useEffect(() => {
    document.body.classList.toggle("dark-mode", isDarkMode);
  }, [isDarkMode]);

  const effectiveInputs = useMemo(() => {
    if (!stravaSummary) return settings;

    const inferredLoad = deriveTrainingLoadFromStrava(stravaSummary);
    const inferredLastQuality = Number.isFinite(Number(stravaSummary.lastQualityDays))
      ? Number(stravaSummary.lastQualityDays)
      : settings.lastQuality;

    return {
      ...settings,
      trainingLoad: inferredLoad || settings.trainingLoad,
      lastQuality: inferredLastQuality,
    };
  }, [settings, stravaSummary]);

  const planData = useMemo(() => {
    const raceDate = new Date(effectiveInputs.raceDate);
    const today = new Date();
    const dayName = dayNames[today.getDay()];
    const daysToRace = daysBetween(today, raceDate);
    const weeksToRace = Math.ceil(daysToRace / 7);
    const week = Math.max(1, effectiveInputs.planLength - weeksToRace + 1);
    const day = ((effectiveInputs.planLength * 7 - daysToRace) % 7) + 1;
    const phase = getPhase(week);
    const focus = getFocus(effectiveInputs);
    const preferredQualityType = getPreferredWorkoutType(effectiveInputs, dayName);

    return {
      daysToRace,
      week,
      day,
      dayName,
      phase,
      focus,
      preferredQualityType,
    };
  }, [effectiveInputs]);

  const openModal = () => {
    setDraft(settings);
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setDraft((prev) => ({
      ...prev,
      [name]:
        name === "planLength" ||
        name === "weeklyDistance" ||
        name === "timeAvailable" ||
        name === "lastQuality"
          ? Number(value)
          : value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setSettings(draft);
    setIsModalOpen(false);
  };

  const handleReset = () => setDraft(defaultSettings);

  const handleSyncStrava = async () => {
    setIsSyncing(true);
    setStatusMessage("");
    try {
      const response = await fetch("/.netlify/functions/strava-history");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to sync Strava.");
      }
      setStravaSummary(payload.summary);
      setStatusMessage("Strava history synced. Training load and last quality are now driven by Strava.");
    } catch (error) {
      setStatusMessage(error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleGenerateAI = async () => {
    if (!stravaSummary) {
      setStatusMessage("Sync Strava before generating AI workouts.");
      return;
    }

    setIsGenerating(true);
    setStatusMessage("");
    try {
      const response = await fetch("/.netlify/functions/ai-workout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: `${settings.goalType} on ${settings.raceDate}`,
          plan: `Week ${planData.week}, day ${planData.day} (${planData.dayName}) of a ${settings.planLength}-week plan.`,
          preferences: [
            `Terrain: ${effectiveInputs.terrain}`,
            `Time available: ${effectiveInputs.timeAvailable} minutes`,
            `Effective load: ${effectiveInputs.trainingLoad}`,
            `Last quality: ${effectiveInputs.lastQuality} day(s) ago`,
            `Preferred quality type today: ${planData.preferredQualityType}`,
            `Day mapping -> intervals: ${effectiveInputs.intervalDays}; tempo: ${effectiveInputs.tempoDays}; long run: ${effectiveInputs.longRunDays}`,
          ].join(". "),
          preferredQualityType: planData.preferredQualityType,
          summary: stravaSummary,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to generate AI workout.");
      setAiWorkout(payload.workout);
      setStatusMessage(payload.source === "fallback" ? "AI key missing; using fallback coach logic." : "AI workout ready.");
    } catch (error) {
      setStatusMessage(error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="app">
      <div className="top-controls">
        <label className="toggle">
          <input
            type="checkbox"
            checked={isDarkMode}
            onChange={(event) => setIsDarkMode(event.target.checked)}
          />
          <span className="toggle-slider" />
          <span className="toggle-label">Dark mode</span>
        </label>
      </div>

      <header className="hero">
        <div>
          <p className="eyebrow">Daily run guidance</p>
          <h1>Personal Trainer Planner</h1>
          <p className="subhead">
            Tailored workouts based on your race goal, time-to-race, and recent training load.
          </p>
        </div>
        <button className="button primary" type="button" onClick={openModal}>
          Adjust inputs
        </button>
      </header>

      <section className="summary" aria-live="polite">
        <div>
          <h2>Your plan overview</h2>
          <p>
            {planData.daysToRace} days until race day · {effectiveInputs.goalType}
          </p>
        </div>
        <div className="card metrics">
          <div>
            <p className="label">Training phase</p>
            <p className="value">{planData.phase}</p>
          </div>
          <div>
            <p className="label">Week / Day</p>
            <p className="value">
              Week {planData.week}, Day {planData.day} ({planData.dayName})
            </p>
          </div>
          <div>
            <p className="label">Quality type today</p>
            <p className="value quality-highlight">{planData.preferredQualityType}</p>
            {hasStravaOverrides ? <p className="metric-note">Auto from Strava sync</p> : null}
          </div>
        </div>
      </section>

      <section className="integrations">
        <div className="card integration-card">
          <div>
            <h3>Strava sync</h3>
            <p>Pull your latest runs to update training load and recovery signals.</p>
          </div>
          <button className="button primary" type="button" onClick={handleSyncStrava} disabled={isSyncing}>
            {isSyncing ? "Syncing…" : "Sync Strava"}
          </button>
        </div>
        <div className="card integration-card">
          <div>
            <h3>AI workout generator</h3>
            <p>Generate a tailored plan using Strava data and your goal inputs.</p>
          </div>
          <button className="button ghost" type="button" onClick={handleGenerateAI} disabled={isGenerating}>
            {isGenerating ? "Generating…" : "Generate workout"}
          </button>
        </div>
        {statusMessage && <p className="status">{statusMessage}</p>}
      </section>

      {stravaSummary && (
        <section className="strava-summary">
          <h3>Recent training load</h3>
          <p className="section-note">Synced data now overrides manual Training load and Last quality fields.</p>
          <div className="card metrics">
            <div>
              <p className="label">Weekly avg</p>
              <p className="value">{stravaSummary.weeklyAverageKm} km</p>
            </div>
            <div>
              <p className="label">Last 6 weeks elevation</p>
              <p className="value">{stravaSummary.totalElevationM} m</p>
            </div>
            <div>
              <p className="label">Quality sessions</p>
              <p className="value">{stravaSummary.qualityCount}</p>
            </div>
            <div>
              <p className="label">Last quality</p>
              <p className="value">
                {stravaSummary.lastQualityDays === "N/A" ? "N/A" : `${stravaSummary.lastQualityDays} days ago`}
              </p>
            </div>
            {stravaSummary.averagePaceMinKm && (
              <div>
                <p className="label">Average pace (6w)</p>
                <p className="value">{stravaSummary.averagePaceMinKm} min/km</p>
              </div>
            )}
            {stravaSummary.fastestPaceMinKm && (
              <div>
                <p className="label">Best pace (6w)</p>
                <p className="value">{stravaSummary.fastestPaceMinKm} min/km</p>
              </div>
            )}
          </div>
        </section>
      )}

      {aiWorkout && (
        <section className="ai-workout">
          <h3>AI suggested workout</h3>
          <div className="runna-stack">
            {[
              { key: "easy_option", label: "Easy run", className: "runna-easy" },
              { key: "quality_option", label: "Quality session", className: "runna-quality" },
            ].map((card, index) => {
              const option = aiWorkout[card.key] || {};
              const segments = normalizeSegments(option);
              return (
                <article className={`runna-card ${card.className}`} key={card.key}>
                  <header className="runna-card-header">
                    <h4>{card.label}</h4>
                  </header>
                  <div className="runna-card-body">
                    <div className="runna-step">{index + 1}</div>
                    <div className="runna-content">
                      <p className="runna-tag">{getWorkoutTag(option.title)}</p>
                      <p className="runna-title">{option.title}</p>
                      <p className="runna-subtitle">{formatPaceTarget(option.target_pace)} · RPE {option.rpe || "n/a"}</p>
                      <div className="runna-segments">
                        {segments.map((segment, segmentIndex) => (
                          <div className="runna-segment" key={`${card.key}-${segment.name}-${segmentIndex}`}>
                            <div>
                              <p className="segment-title">
                                {segment.name}
                                {segment.repeat ? <span className="segment-repeat">Repeat x{segment.repeat}</span> : null}
                              </p>
                              <p className="segment-detail">{segment.instruction}</p>
                              <p className="segment-meta">
                                {formatPaceTarget(segment.target_pace)}
                                {segment.rpe ? ` · RPE ${segment.rpe}` : ""}
                              </p>
                            </div>
                            <p className="segment-type">{segment.workout_type || "RUN"}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="coach-grid">
            <div className="card coach-panel">
              <h4>Coach reasoning</h4>
              <ul className="coach-list">
                {aiWorkout.reasoning?.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
            <div className="card coach-panel warning-panel">
              <h4>Warnings & reminders</h4>
              {aiWorkout.warnings?.length ? (
                <ul className="coach-list warnings">
                  {aiWorkout.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : (
                <p className="coach-clear">No warnings. Keep the effort controlled and recover well afterwards.</p>
              )}
            </div>
          </div>
        </section>
      )}

      <div className={`modal ${isModalOpen ? "open" : ""}`} aria-hidden={!isModalOpen}>
        <div className="modal-backdrop" onClick={closeModal} aria-hidden="true" />
        <div className="modal-content" role="dialog" aria-modal="true">
          <div className="modal-header">
            <h2>Plan settings</h2>
            <button className="button ghost" type="button" onClick={closeModal}>
              Close
            </button>
          </div>
          <form onSubmit={handleSubmit} onReset={handleReset}>
            <div className="form-grid">
              <label htmlFor="goalType">
                Goal race type
                <input id="goalType" name="goalType" type="text" value={draft.goalType} onChange={handleChange} />
              </label>
              <label htmlFor="raceDate">
                Race date
                <input id="raceDate" name="raceDate" type="date" value={draft.raceDate} onChange={handleChange} />
              </label>
              <label htmlFor="planLength">
                Plan length (weeks)
                <input
                  id="planLength"
                  name="planLength"
                  type="number"
                  min="8"
                  max="24"
                  value={draft.planLength}
                  onChange={handleChange}
                />
              </label>
              <label htmlFor="weeklyDistance">
                Weekly distance (km)
                <input
                  id="weeklyDistance"
                  name="weeklyDistance"
                  type="number"
                  min="5"
                  max="200"
                  value={draft.weeklyDistance}
                  onChange={handleChange}
                />
              </label>
              <label htmlFor="trainingLoad">
                Current training load
                {hasStravaOverrides ? <span className="input-hint">Auto-calculated from Strava</span> : null}
                <select
                  id="trainingLoad"
                  name="trainingLoad"
                  value={hasStravaOverrides ? effectiveInputs.trainingLoad : draft.trainingLoad}
                  onChange={handleChange}
                  disabled={hasStravaOverrides}
                >
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                </select>
              </label>
              <label htmlFor="terrain">
                Recent terrain
                <select id="terrain" name="terrain" value={draft.terrain} onChange={handleChange}>
                  <option value="flat">Mostly flat</option>
                  <option value="mixed">Mixed</option>
                  <option value="hilly">Hilly</option>
                  <option value="trail">Trail-heavy</option>
                </select>
              </label>
              <label htmlFor="timeAvailable">
                Time available (minutes)
                <input
                  id="timeAvailable"
                  name="timeAvailable"
                  type="number"
                  min="20"
                  max="180"
                  value={draft.timeAvailable}
                  onChange={handleChange}
                />
              </label>
              <label htmlFor="lastQuality">
                Last quality workout (days ago)
                {hasStravaOverrides ? <span className="input-hint">Auto-synced from Strava</span> : null}
                <input
                  id="lastQuality"
                  name="lastQuality"
                  type="number"
                  min="1"
                  max="14"
                  value={hasStravaOverrides ? effectiveInputs.lastQuality : draft.lastQuality}
                  onChange={handleChange}
                  disabled={hasStravaOverrides}
                />
              </label>
              <label htmlFor="intervalDays">
                Quality pattern: intervals days
                <input
                  id="intervalDays"
                  name="intervalDays"
                  type="text"
                  value={draft.intervalDays}
                  onChange={handleChange}
                />
              </label>
              <label htmlFor="tempoDays">
                Quality pattern: tempo days
                <input id="tempoDays" name="tempoDays" type="text" value={draft.tempoDays} onChange={handleChange} />
              </label>
              <label htmlFor="longRunDays">
                Quality pattern: long run days
                <input
                  id="longRunDays"
                  name="longRunDays"
                  type="text"
                  value={draft.longRunDays}
                  onChange={handleChange}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button className="button ghost" type="reset">
                Reset
              </button>
              <button className="button primary" type="submit">
                Save &amp; refresh
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PlanApp;
