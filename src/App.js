import { useMemo, useState } from "react";
import "./App.css";

const phaseMap = [
  { name: "Foundation", range: [1, 4] },
  { name: "Build", range: [5, 10] },
  { name: "Peak", range: [11, 14] },
  { name: "Taper", range: [15, 16] },
];

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
};

const formatNumber = (value) => Number(value).toFixed(1).replace(/\.0$/, "");

const daysBetween = (start, end) =>
  Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

const getPhase = (week) =>
  phaseMap.find((phase) => week >= phase.range[0] && week <= phase.range[1])?.name ||
  "Custom";

const getFocus = (inputs) => {
  if (inputs.trainingLoad === "high") {
    return "Recovery emphasis";
  }
  if (inputs.lastQuality >= 5) {
    return "Quality session ready";
  }
  return "Aerobic development";
};

const deriveEasyRun = (inputs) => {
  const weeklyDistance = Number(inputs.weeklyDistance);
  const suggested = Math.max(6, Math.min(14, weeklyDistance * 0.22));
  const distance = formatNumber(suggested);
  const paceCap = inputs.trainingLoad === "high" ? "5:30" : "5:15";
  return {
    distance,
    paceCap,
    detail: `Keep effort conversational. Stop around ${distance} km or when time hits ${inputs.timeAvailable} minutes.`,
  };
};

const deriveQuality = (inputs) => {
  const isHilly =
    inputs.terrain === "hilly" ||
    inputs.terrain === "trail" ||
    inputs.goalType.toLowerCase().includes("hill");

  if (isHilly) {
    return {
      type: "Hill intervals",
      main: "1.6 km warm up → 11× (60s hard uphill / 30s walk, jog down) → 1.6 km cool down",
      detail:
        "Aim for tall posture and quick cadence. Keep uphill efforts controlled and focus on strong form.",
    };
  }

  return {
    type: "Tempo ladder",
    main: "2 km warm up → 3× (6 min steady / 2 min easy jog) → 1.5 km cool down",
    detail: "Hold steady effort just below 10K pace. Keep recovery jogs relaxed.",
  };
};

const buildReasons = (inputs, week, phase, focus) => [
  `Race goal: ${inputs.goalType}.`,
  `Plan timing: week ${week} (${phase} phase) with ${inputs.daysToRace} days to race day.`,
  `Recent load is ${inputs.trainingLoad}; last quality session was ${inputs.lastQuality} days ago.`,
  `Terrain bias: ${inputs.terrain} routes to match race demands.`,
  `Weekly distance is ~${inputs.weeklyDistance} km, so today targets about 20–25% volume.`,
  `Focus for today: ${focus}.`,
];

const PlanApp = () => {
  const [settings, setSettings] = useState(defaultSettings);
  const [draft, setDraft] = useState(defaultSettings);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const planData = useMemo(() => {
    const raceDate = new Date(settings.raceDate);
    const today = new Date();
    const daysToRace = daysBetween(today, raceDate);
    const weeksToRace = Math.ceil(daysToRace / 7);
    const week = Math.max(1, settings.planLength - weeksToRace + 1);
    const day = ((settings.planLength * 7 - daysToRace) % 7) + 1;
    const phase = getPhase(week);
    const focus = getFocus(settings);

    return {
      daysToRace,
      week,
      day,
      phase,
      focus,
      easyRun: deriveEasyRun(settings),
      qualityRun: deriveQuality(settings),
      reasons: buildReasons({ ...settings, daysToRace }, week, phase, focus),
    };
  }, [settings]);

  const openModal = () => {
    setDraft(settings);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setDraft((prev) => ({
      ...prev,
      [name]: name === "planLength" || name === "weeklyDistance" || name === "timeAvailable" || name === "lastQuality"
        ? Number(value)
        : value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setSettings(draft);
    setIsModalOpen(false);
  };

  const handleReset = () => {
    setDraft(defaultSettings);
  };

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Daily run guidance</p>
          <h1>Personal Trainer Planner</h1>
          <p className="subhead">
            Tailored workouts based on your race goal, time-to-race, and recent
            training load.
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
            {planData.daysToRace} days until race day · {settings.goalType}
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
              Week {planData.week}, Day {planData.day}
            </p>
          </div>
          <div>
            <p className="label">Suggested focus</p>
            <p className="value">{planData.focus}</p>
          </div>
        </div>
      </section>

      <section className="workouts">
        <div className="card workout">
          <div className="workout-header">
            <h3>Option A · Easy Run</h3>
            <span className="pill">≤ {planData.easyRun.paceCap} / km</span>
          </div>
          <p className="workout-main">{planData.easyRun.distance} km easy run</p>
          <p className="workout-detail">{planData.easyRun.detail}</p>
        </div>
        <div className="card workout">
          <div className="workout-header">
            <h3>Option B · Quality Session</h3>
            <span className="pill">{planData.qualityRun.type}</span>
          </div>
          <p className="workout-main">{planData.qualityRun.main}</p>
          <p className="workout-detail">{planData.qualityRun.detail}</p>
        </div>
      </section>

      <section className="explain">
        <h3>Why this workout?</h3>
        <ul>
          {planData.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </section>

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
                <input
                  id="goalType"
                  name="goalType"
                  type="text"
                  value={draft.goalType}
                  onChange={handleChange}
                />
              </label>
              <label htmlFor="raceDate">
                Race date
                <input
                  id="raceDate"
                  name="raceDate"
                  type="date"
                  value={draft.raceDate}
                  onChange={handleChange}
                />
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
                <select
                  id="trainingLoad"
                  name="trainingLoad"
                  value={draft.trainingLoad}
                  onChange={handleChange}
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
                <input
                  id="lastQuality"
                  name="lastQuality"
                  type="number"
                  min="1"
                  max="14"
                  value={draft.lastQuality}
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
