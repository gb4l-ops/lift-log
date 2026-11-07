const STORAGE_KEY = "lift-log-v1";

const TEMPLATES = [
  {
    id: "upper-a",
    name: "Upper A",
    blurb: "Monday · about 60 min",
    exercises: [
      { name: "Neutral-grip DB incline press", kind: "reps", shoulder: true, target: "3 × 8–12", restHint: "90–120s", setsGoal: 3, hint: "30–45°" },
      { name: "Chest-supported or machine row", kind: "reps", target: "3 × 8–12", restHint: "90–120s", setsGoal: 3 },
      { name: "Landmine or single-arm cable press", kind: "reps", shoulder: true, target: "3 × 8–12", restHint: "90–120s", setsGoal: 3, hint: "Each side if one-arm" },
      { name: "Lat pulldown or assisted pull-up", kind: "reps", target: "3 × 8–12", restHint: "90s", setsGoal: 3 },
      { name: "Face pulls or rear-delt fly", kind: "reps", target: "2 × 12–15", restHint: "60s", setsGoal: 2 },
      { name: "Dead bug or plank", kind: "flex", target: "Dead bug 2 × 8/side or plank 2 × 30–40s", restHint: "45–60s", setsGoal: 2 }
    ]
  },
  {
    id: "lower",
    name: "Lower + core",
    blurb: "Saturday · about 60–75 min · no squats",
    exercises: [
      { name: "Leg press", kind: "reps", target: "3 × 8–12", restHint: "2 min", setsGoal: 3 },
      { name: "Romanian deadlift", kind: "reps", target: "3 × 8–12", restHint: "2 min", setsGoal: 3 },
      { name: "Bulgarian split squat or reverse lunge", kind: "reps", target: "3 × 8–10 each", restHint: "90–120s", setsGoal: 3 },
      { name: "Leg curl", kind: "reps", target: "2 × 10–15", restHint: "90s", setsGoal: 2 },
      { name: "Straight-knee calf raise", kind: "reps", target: "2 × 10–15", restHint: "90s", setsGoal: 2 },
      { name: "Hanging knee raise or captain's chair", kind: "reps", bodyweight: true, target: "8–12", restHint: "45–60s", setsGoal: "2–3", hint: "Core circuit, 2–3 rounds" },
      { name: "Cable crunch", kind: "reps", target: "10–15", restHint: "45–60s", setsGoal: "2–3", hint: "Core circuit, 2–3 rounds" },
      { name: "Side plank", kind: "time", timeLabel: "sec", sided: true, bodyweight: true, target: "20–30s each side", restHint: "45–60s", setsGoal: "2–3", hint: "Core circuit, 2–3 rounds" }
    ]
  },
  {
    id: "upper-b",
    name: "Upper B",
    blurb: "Sunday · about 60–75 min",
    exercises: [
      { name: "Neutral-grip machine chest press", kind: "reps", shoulder: true, target: "3 × 8–12", restHint: "90–120s", setsGoal: 3 },
      { name: "One-arm DB or cable row", kind: "reps", target: "3 × 8–12 each", restHint: "90–120s", setsGoal: 3 },
      { name: "Face pulls", kind: "reps", target: "3 × 12–15", restHint: "60s", setsGoal: 3 },
      { name: "Lat pulldown (different grip than Monday)", kind: "reps", target: "3 × 8–12", restHint: "90s", setsGoal: 3 },
      { name: "Lateral raise", kind: "reps", target: "3 × 12–15", restHint: "60s", setsGoal: 3 },
      {
        name: "Curl + rope pushdown",
        kind: "superset",
        parts: ["Curl", "Rope pushdown"],
        target: "2–3 × 10–15 each",
        restHint: "90s",
        setsGoal: "2–3"
      },
      {
        name: "Suitcase hold (in place)",
        kind: "time",
        timeLabel: "sec",
        sided: true,
        target: "2 × 30–40s each side",
        restHint: "45–60s",
        setsGoal: 2,
        hint: "No walking"
      },
      {
        name: "Dead bug (extra time)",
        kind: "flex",
        bodyweight: true,
        target: "2 × 8/side",
        restHint: "45–60s",
        setsGoal: 2,
        hint: "If you have extra time"
      }
    ]
  },
  {
    id: "extras",
    name: "Recovery extras",
    blurb: "Optional Tuesday / Thursday",
    exercises: [
      { name: "Band pull-aparts", kind: "reps", bodyweight: true, target: "2 × 20", restHint: "60s", setsGoal: 2 },
      { name: "Face pulls", kind: "reps", target: "2 × 15", restHint: "60s", setsGoal: 2 },
      { name: "Dead bugs", kind: "flex", bodyweight: true, target: "2 × 8/side", restHint: "45–60s", setsGoal: 2 },
      { name: "Side planks", kind: "time", timeLabel: "sec", sided: true, bodyweight: true, target: "2 × 20–30s", restHint: "45–60s", setsGoal: 2 },
      { name: "Easy bike", kind: "time", timeLabel: "min", bodyweight: true, target: "10 min if you want" }
    ]
  },
  { id: "custom", name: "Custom", blurb: "Blank session", exercises: [] }
];

let db = { sessions: [] };
let view = "home";
let activeId = null;
let saveError = "";

const REST_PRESETS = [60, 90, 120, 180];
let rest = {
  durationSec: 90,
  endsAt: null,
  remainingMs: 0,
  status: "idle",
  tickId: null
};
let restHintUntil = 0;
let audioCtx = null;
let wakeLock = null;

function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

function chicagoWeekday() {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short"
  }).format(new Date());
}

function formatChicago(iso) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(iso));
}

function suggestedTemplateId() {
  const day = chicagoWeekday();
  if (day === "Mon") return "upper-a";
  if (day === "Sat") return "lower";
  if (day === "Sun") return "upper-b";
  if (day === "Tue" || day === "Thu") return "extras";
  return null;
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { sessions: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.sessions)) return { sessions: [] };
    const restSec = Number(parsed.restSec);
    const out = { sessions: parsed.sessions };
    if (Number.isFinite(restSec) && restSec >= 15) {
      out.restSec = Math.min(3600, Math.round(restSec));
    }
    return out;
  } catch (err) {
    saveError = "Could not read saved workouts on this phone.";
    return { sessions: [] };
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    saveError = "";
    return true;
  } catch (err) {
    saveError = "Could not save on this phone. Check storage and try again.";
    return false;
  }
}

function inProgress() {
  return db.sessions.find((session) => !session.finishedAt) || null;
}

function activeSession() {
  return db.sessions.find((session) => session.id === activeId) || null;
}

function templateById(id) {
  return TEMPLATES.find((item) => item.id === id);
}

function prescriptionFor(session, exercise) {
  const template = session && templateById(session.templateId);
  const match = template && (template.exercises || []).find((item) => item.name === exercise.name);
  return {
    target: exercise.target || (match && match.target) || "",
    restHint: exercise.restHint || (match && match.restHint) || "",
    setsGoal: exercise.setsGoal || (match && match.setsGoal) || "",
    hint: (match && match.hint) || exercise.hint || ""
  };
}

function lastLoggedSet(exerciseName, partName) {
  const finished = db.sessions
    .filter((session) => session.finishedAt)
    .sort((a, b) => String(b.finishedAt).localeCompare(String(a.finishedAt)));
  for (const session of finished) {
    const match = (session.exercises || []).find((exercise) => exercise.name === exerciseName);
    if (!match || !match.sets || !match.sets.length) continue;
    const set = match.sets[match.sets.length - 1];
    if (partName && set.parts) {
      const part = set.parts.find((item) => item.name === partName);
      if (part) return { weight: part.weight, reps: part.reps };
      continue;
    }
    return {
      weight: set.weight,
      reps: set.reps,
      seconds: set.seconds,
      side: set.side
    };
  }
  return null;
}

function emptySet(exercise) {
  if (exercise.kind === "superset") {
    return {
      id: uid(),
      note: "",
      parts: (exercise.parts || []).map((name) => {
        const prev = lastLoggedSet(exercise.name, name);
        return {
          name,
          weight: prev && prev.weight != null ? prev.weight : "",
          reps: prev && prev.reps != null ? prev.reps : ""
        };
      })
    };
  }
  const prev = lastLoggedSet(exercise.name);
  return {
    id: uid(),
    note: "",
    weight: prev && prev.weight != null ? prev.weight : "",
    reps: prev && prev.reps != null ? prev.reps : "",
    seconds: prev && prev.seconds != null ? prev.seconds : "",
    side: exercise.sided ? (prev && prev.side) || "L" : ""
  };
}

function startSession(templateId) {
  const current = inProgress();
  if (current) {
    if (!confirm("You already have a workout in progress. Open that one instead?")) return;
    activeId = current.id;
    view = "session";
    render();
    return;
  }
  const template = templateById(templateId) || templateById("custom");
  const session = {
    id: uid(),
    templateId: template.id,
    name: template.name,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    note: "",
    exercises: (template.exercises || []).map((exercise) => ({
      id: uid(),
      name: exercise.name,
      kind: exercise.kind,
      shoulder: !!exercise.shoulder,
      bodyweight: !!exercise.bodyweight,
      timeLabel: exercise.timeLabel || "sec",
      sided: !!exercise.sided,
      hint: exercise.hint || "",
      target: exercise.target || "",
      restHint: exercise.restHint || "",
      setsGoal: exercise.setsGoal == null ? "" : exercise.setsGoal,
      parts: exercise.parts ? exercise.parts.slice() : null,
      exerciseNote: "",
      sets: []
    }))
  };
  db.sessions.unshift(session);
  persist();
  activeId = session.id;
  view = "session";
  render();
}

function finishSession() {
  const session = activeSession();
  if (!session) return;
  const logged = countSets(session);
  if (!logged && !confirm("No sets logged yet. Finish anyway?")) return;
  session.finishedAt = new Date().toISOString();
  persist();
  render();
}

function discardSession() {
  const session = activeSession();
  if (!session) return;
  if (!confirm("Delete this workout from the phone?")) return;
  db.sessions = db.sessions.filter((item) => item.id !== session.id);
  persist();
  activeId = null;
  view = "home";
  render();
}

function countSets(session) {
  return (session.exercises || []).reduce((sum, exercise) => sum + (exercise.sets || []).length, 0);
}

function formatLoad(weight) {
  if (weight === "" || weight == null) return "";
  return String(weight) + " lb";
}

function formatSetLine(exercise, set) {
  if (exercise.kind === "superset") {
    return (set.parts || [])
      .map((part) => {
        const bits = [part.name];
        if (part.reps !== "" && part.reps != null) bits.push(String(part.reps));
        const load = formatLoad(part.weight);
        if (load) bits.push("x " + load);
        return bits.join(" ");
      })
      .join("  +  ");
  }
  const bits = [];
  if (exercise.sided && set.side) bits.push(set.side);
  if (exercise.kind === "time" || (exercise.kind === "flex" && set.seconds !== "" && set.seconds != null)) {
    if (set.seconds !== "" && set.seconds != null) {
      bits.push(String(set.seconds) + (exercise.timeLabel === "min" ? " min" : "s"));
    }
  }
  if (exercise.kind !== "time" && set.reps !== "" && set.reps != null) bits.push(String(set.reps) + " reps");
  const load = formatLoad(set.weight);
  if (load) bits.push(load);
  const line = bits.join(" · ");
  return line || "(empty set)";
}

function sessionSummary(session) {
  const lines = [
    "Lift Log — " + formatChicago(session.finishedAt || session.startedAt) + " CT",
    session.name + (session.finishedAt ? "" : " (in progress)"),
    ""
  ];
  for (const exercise of session.exercises || []) {
    if (!exercise.sets.length) continue;
    const rx = prescriptionFor(session, exercise);
    lines.push(exercise.name + (rx.target ? " — " + rx.target : ""));
    if (exercise.exerciseNote) lines.push("  note: " + exercise.exerciseNote);
    exercise.sets.forEach((set, index) => {
      let line = "  " + (index + 1) + ") " + formatSetLine(exercise, set);
      if (set.note) line += " — " + set.note;
      lines.push(line);
    });
    lines.push("");
  }
  if (session.note) {
    lines.push("Session note: " + session.note);
    lines.push("");
  }
  const body = lines.join("\n").trim();
  return body || "Lift Log — no sets logged.";
}

async function shareSession() {
  const session = activeSession();
  if (!session) return;
  const text = sessionSummary(session);
  try {
    if (navigator.share) {
      await navigator.share({ title: "Lift Log", text });
      return;
    }
  } catch (err) {
    if (err && err.name === "AbortError") return;
  }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      alert("Copied. Paste it in your chat with Might Guy.");
      return;
    }
  } catch (err) {
    /* fall through */
  }
  prompt("Copy this and paste it in your chat with Might Guy:", text);
}

function addExercise(session) {
  const name = prompt("Exercise name?");
  if (!name || !name.trim()) return;
  session.exercises.push({
    id: uid(),
    name: name.trim(),
    kind: "reps",
    shoulder: /press|bench/i.test(name),
    bodyweight: false,
    timeLabel: "sec",
    sided: false,
    hint: "",
    parts: null,
    exerciseNote: "",
    sets: []
  });
  persist();
  render();
}

function nudge(value, delta, min) {
  const next = (Number(value) || 0) + delta;
  return String(Math.max(min, next));
}

function formatRest(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes + ":" + String(seconds).padStart(2, "0");
}

function remainingMs() {
  if (rest.status === "running" && rest.endsAt) return Math.max(0, rest.endsAt - Date.now());
  if (rest.status === "paused") return Math.max(0, rest.remainingMs || 0);
  return Math.max(0, (rest.durationSec || 90) * 1000);
}

function restVisible() {
  if (rest.status !== "idle") return true;
  if (view !== "session") return false;
  const session = activeSession();
  return !!(session && !session.finishedAt);
}

function unlockAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch (err) {
    /* older phones may block Web Audio */
  }
}

function beepDone() {
  try {
    unlockAudio();
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    [0, 0.22, 0.44].forEach((offset, index) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880 + index * 220;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.18, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.2);
    });
  } catch (err) {
    /* beep is optional */
  }
}

async function requestWake() {
  try {
    if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request("screen");
  } catch (err) {
    wakeLock = null;
  }
}

function releaseWake() {
  if (!wakeLock) return;
  wakeLock.release().catch(() => {});
  wakeLock = null;
}

function stopTick() {
  if (rest.tickId) {
    clearInterval(rest.tickId);
    rest.tickId = null;
  }
}

function startTick() {
  stopTick();
  rest.tickId = setInterval(syncRest, 200);
}

function setRestDuration(sec) {
  const next = Math.max(15, Math.min(3600, Math.round(Number(sec) || 90)));
  rest.durationSec = next;
  db.restSec = next;
  persist();
  if (rest.status === "idle") renderRest();
}

function addRest(deltaSec) {
  if (rest.status === "running") {
    rest.endsAt = Math.max(Date.now(), (rest.endsAt || Date.now()) + deltaSec * 1000);
    updateRestClock();
    return;
  }
  if (rest.status === "paused") {
    rest.remainingMs = Math.max(15000, (rest.remainingMs || 0) + deltaSec * 1000);
    renderRest();
    return;
  }
  setRestDuration((rest.durationSec || 90) + deltaSec);
}

function updateRestClock() {
  const timeEl = document.getElementById("rest-time");
  if (rest.status === "done") {
    if (timeEl) timeEl.textContent = "REST OVER";
    document.title = "REST OVER · Lift Log";
    return;
  }
  const label = formatRest(remainingMs());
  if (timeEl) timeEl.textContent = label;
  if (rest.status === "running") document.title = label + " · Lift Log";
  else if (rest.status === "paused") document.title = label + " paused · Lift Log";
  else document.title = "Lift Log";
}

function syncRest() {
  if (rest.status !== "running") return;
  if (remainingMs() <= 0) {
    finishRest();
    return;
  }
  updateRestClock();
}

function finishRest() {
  rest.status = "done";
  rest.endsAt = null;
  rest.remainingMs = 0;
  stopTick();
  releaseWake();
  beepDone();
  try {
    if (navigator.vibrate) navigator.vibrate([250, 120, 250, 120, 500]);
  } catch (err) {
    /* iPhone ignores vibrate */
  }
  renderRest();
}

function startRest() {
  unlockAudio();
  const ms = rest.status === "paused" ? rest.remainingMs : rest.durationSec * 1000;
  if (!ms || ms <= 0) return;
  rest.endsAt = Date.now() + ms;
  rest.status = "running";
  restHintUntil = 0;
  requestWake();
  startTick();
  renderRest();
}

function pauseRest() {
  if (rest.status !== "running") return;
  rest.remainingMs = remainingMs();
  rest.endsAt = null;
  rest.status = "paused";
  stopTick();
  releaseWake();
  renderRest();
}

function resetRest() {
  rest.status = "idle";
  rest.endsAt = null;
  rest.remainingMs = 0;
  restHintUntil = 0;
  stopTick();
  releaseWake();
  document.title = "Lift Log";
  renderRest();
}

function hintRest() {
  restHintUntil = Date.now() + 4000;
  renderRest();
  setTimeout(() => {
    if (Date.now() >= restHintUntil) renderRest();
  }, 4100);
}

function renderRest() {
  const root = document.getElementById("rest-root");
  if (!root) return;
  const show = restVisible();
  document.body.classList.toggle("has-rest", show);
  if (!show) {
    root.innerHTML = "";
    if (rest.status === "idle") document.title = "Lift Log";
    return;
  }

  const status = rest.status;
  const hint = status === "idle" && Date.now() < restHintUntil;
  let inner = `<div class="rest-bar ${esc(status)}" id="rest-bar">`;

  if (status === "done") {
    inner += `
      <div class="rest-label">Rest timer</div>
      <div class="rest-time" id="rest-time">REST OVER</div>
      <div class="rest-actions">
        <button type="button" class="btn primary" data-act="rest-start">Start rest again</button>
        <button type="button" class="btn ghost" data-act="rest-reset">Dismiss</button>
      </div>
    `;
  } else if (status === "running" || status === "paused") {
    inner += `
      <div class="rest-label">${status === "paused" ? "Rest paused" : "Resting"}</div>
      <div class="rest-time" id="rest-time">${esc(formatRest(remainingMs()))}</div>
      <div class="rest-actions">
        ${status === "running"
          ? `<button type="button" class="btn" data-act="rest-pause">Pause</button>`
          : `<button type="button" class="btn primary" data-act="rest-start">Resume</button>`}
        <button type="button" class="btn rest-adjust" data-act="rest-plus">+15s</button>
        <button type="button" class="btn ghost" data-act="rest-reset">Reset</button>
      </div>
    `;
  } else {
    const chips = REST_PRESETS.map((sec) => {
      const pretty = sec === 60 ? "60s" : sec === 90 ? "90s" : sec === 120 ? "2 min" : "3 min";
      return `<button type="button" class="${rest.durationSec === sec ? "on" : ""}" data-act="rest-preset" data-sec="${sec}">${pretty}</button>`;
    }).join("");
    inner += `
      <div class="rest-head">
        <span class="rest-label">Rest timer</span>
        <span class="rest-time" id="rest-time">${esc(formatRest(rest.durationSec * 1000))}</span>
      </div>
      <div class="rest-presets">${chips}</div>
      <div class="rest-actions">
        <button type="button" class="btn rest-adjust" data-act="rest-minus">−15</button>
        <button type="button" class="btn primary${hint ? " hint" : ""}" data-act="rest-start">Start rest</button>
        <button type="button" class="btn rest-adjust" data-act="rest-plus">+15</button>
      </div>
    `;
  }

  inner += `</div>`;
  root.innerHTML = inner;
  updateRestClock();
}

function bind() {
  const app = document.getElementById("app");
  app.onclick = (event) => {
    const btn = event.target.closest("[data-act]");
    if (!btn) return;
    const act = btn.dataset.act;
    const session = activeSession();
    if (act === "home") {
      view = "home";
      activeId = null;
      render();
      return;
    }
    if (act === "start") {
      startSession(btn.dataset.id);
      return;
    }
    if (act === "open") {
      activeId = btn.dataset.id;
      view = "session";
      render();
      return;
    }
    if (!session) return;
    const exercise = session.exercises.find((item) => item.id === btn.dataset.ex);
    const set = exercise && exercise.sets.find((item) => item.id === btn.dataset.set);
    if (act === "finish") finishSession();
    else if (act === "resume") {
      session.finishedAt = null;
      persist();
      render();
    } else if (act === "discard") discardSession();
    else if (act === "share") shareSession();
    else if (act === "add-ex") addExercise(session);
    else if (act === "del-ex" && exercise) {
      if (exercise.sets.length && !confirm("Remove " + exercise.name + "?")) return;
      session.exercises = session.exercises.filter((item) => item.id !== exercise.id);
      persist();
      render();
    } else if (act === "add-set" && exercise) {
      exercise.sets.push(emptySet(exercise));
      persist();
      render();
      hintRest();
    } else if (act === "del-set" && exercise && set) {
      exercise.sets = exercise.sets.filter((item) => item.id !== set.id);
      persist();
      render();
    } else if (act === "side" && set) {
      set.side = btn.dataset.side;
      persist();
      btn.parentElement.querySelectorAll("button").forEach((item) => {
        item.classList.toggle("on", item.dataset.side === set.side);
      });
    } else if (act === "step" && set) {
      const field = btn.dataset.field;
      const delta = Number(btn.dataset.delta);
      let next = "";
      if (btn.dataset.part) {
        const part = set.parts.find((item) => item.name === btn.dataset.part);
        if (part) {
          part[field] = nudge(part[field], delta, 0);
          next = part[field];
        }
      } else {
        set[field] = nudge(set[field], delta, 0);
        next = set[field];
      }
      persist();
      const input = btn.parentElement.querySelector('input[data-field="' + field + '"]');
      if (input) input.value = next;
    }
  };

  app.oninput = (event) => {
    const el = event.target;
    if (!el.dataset.field && !el.dataset.session) return;
    const session = activeSession();
    if (!session) return;
    if (el.dataset.session === "note") {
      session.note = el.value;
      persist();
      return;
    }
    const exercise = session.exercises.find((item) => item.id === el.dataset.ex);
    if (!exercise) return;
    if (el.dataset.field === "exerciseNote") {
      exercise.exerciseNote = el.value;
      persist();
      return;
    }
    const set = exercise.sets.find((item) => item.id === el.dataset.set);
    if (!set) return;
    if (el.dataset.part) {
      const part = set.parts.find((item) => item.name === el.dataset.part);
      if (part) part[el.dataset.field] = el.value === "" ? "" : el.value;
    } else {
      set[el.dataset.field] = el.value === "" ? "" : el.value;
    }
    persist();
  };
}

function stepper(field, value, set, exercise, partName, step) {
  const delta = step == null ? (field === "weight" ? 5 : 1) : step;
  const partAttr = partName ? ` data-part="${esc(partName)}"` : "";
  return `
    <div class="stepper">
      <button type="button" data-act="step" data-field="${field}" data-delta="-${delta}" data-ex="${exercise.id}" data-set="${set.id}"${partAttr}>−</button>
      <input inputmode="decimal" data-field="${field}" data-ex="${exercise.id}" data-set="${set.id}"${partAttr} value="${esc(value)}">
      <button type="button" data-act="step" data-field="${field}" data-delta="${delta}" data-ex="${exercise.id}" data-set="${set.id}"${partAttr}>+</button>
    </div>
  `;
}

function renderSetControls(exercise, set) {
  if (exercise.kind === "superset") {
    return (set.parts || []).map((part) => `
      <div class="part-label">${esc(part.name)}</div>
      <div class="row">
        ${stepper("weight", part.weight, set, exercise, part.name, 5)}
        <span class="unit">lb</span>
        ${stepper("reps", part.reps, set, exercise, part.name, 1)}
        <span class="unit">reps</span>
      </div>
    `).join("");
  }
  const showWeight = !exercise.bodyweight || exercise.kind === "reps" || exercise.kind === "flex";
  const showReps = exercise.kind === "reps" || exercise.kind === "flex";
  const showTime = exercise.kind === "time" || exercise.kind === "flex";
  let html = "";
  if (exercise.sided) {
    html += `
      <div class="side">
        <button type="button" class="${set.side === "L" ? "on" : ""}" data-act="side" data-side="L" data-ex="${exercise.id}" data-set="${set.id}">Left</button>
        <button type="button" class="${set.side === "R" ? "on" : ""}" data-act="side" data-side="R" data-ex="${exercise.id}" data-set="${set.id}">Right</button>
      </div>
    `;
  }
  html += `<div class="row">`;
  if (showWeight) {
    html += `${stepper("weight", set.weight, set, exercise, null, 5)}<span class="unit">lb</span>`;
  }
  if (showReps) {
    html += `${stepper("reps", set.reps, set, exercise, null, 1)}<span class="unit">reps</span>`;
  }
  if (showTime) {
    html += `${stepper("seconds", set.seconds, set, exercise, null, exercise.timeLabel === "min" ? 1 : 5)}<span class="unit">${exercise.timeLabel === "min" ? "min" : "sec"}</span>`;
  }
  html += `</div>`;
  return html;
}

function renderHome() {
  const suggestion = suggestedTemplateId();
  const day = chicagoWeekday();
  const current = inProgress();
  const finished = db.sessions.filter((session) => session.finishedAt);
  let html = `
    <div class="top"><h1>Lift Log</h1></div>
    <p class="sub">Log sets as you go. History stays on this phone until you copy a session for Might Guy.</p>
  `;
  if (saveError) html += `<div class="banner error">${esc(saveError)}</div>`;
  if (current) {
    html += `<button class="banner hist" data-act="open" data-id="${current.id}">Workout in progress — resume ${esc(current.name)}</button>`;
  }
  if (day === "Wed" || day === "Fri") {
    html += `<p class="sub">Hoops day — Lower + core is available, just not suggested.</p>`;
  } else if (suggestion) {
    const tmpl = templateById(suggestion);
    html += `<p class="sub">Today’s suggestion: ${esc(tmpl.name)}.</p>`;
  }
  html += `<div class="list">`;
  for (const template of TEMPLATES) {
    html += `
      <button class="tmpl${template.id === suggestion ? " suggested" : ""}" data-act="start" data-id="${template.id}">
        <strong>${esc(template.name)}</strong>
        <span>${esc(template.blurb)}</span>
      </button>
    `;
  }
  html += `</div><hr class="sep"><h2>History</h2>`;
  if (!finished.length) {
    html += `<p class="empty">No sessions yet.</p>`;
  } else {
    html += `<div class="list" style="margin-top:10px">`;
    for (const session of finished) {
      html += `
        <button class="card hist" data-act="open" data-id="${session.id}">
          <strong>${esc(session.name)}</strong>
          <span class="meta">${esc(formatChicago(session.finishedAt))} · ${countSets(session)} sets</span>
        </button>
      `;
    }
    html += `</div>`;
  }
  return html;
}

function renderSession() {
  const session = activeSession();
  if (!session) return renderHome();
  const done = !!session.finishedAt;
  let html = `
    <div class="top">
      <button class="btn ghost small" data-act="home">Back</button>
      <h1>${esc(session.name)}</h1>
      <span></span>
    </div>
    <p class="sub">${esc(formatChicago(session.startedAt))}${done ? " · finished " + esc(formatChicago(session.finishedAt)) : " · in progress"}</p>
  `;
  if (saveError) html += `<div class="banner error">${esc(saveError)}</div>`;
  for (const exercise of session.exercises) {
    const rx = prescriptionFor(session, exercise);
    html += `
      <section class="card ex">
        <div class="ex-head">
          <div>
            <strong class="ex-name">${esc(exercise.name)}</strong>
            ${rx.target ? `<span class="target">${esc(rx.target)}${rx.restHint ? `<span class="target-rest"> · rest ${esc(rx.restHint)}</span>` : ""}</span>` : ""}
            ${rx.hint ? `<span class="meta">${esc(rx.hint)}</span>` : ""}
          </div>
          <button class="btn danger small" data-act="del-ex" data-ex="${exercise.id}">Remove</button>
        </div>
        ${exercise.shoulder ? `<textarea class="note" rows="2" placeholder="How's the left shoulder?" data-field="exerciseNote" data-ex="${exercise.id}">${esc(exercise.exerciseNote)}</textarea>` : ""}
        ${exercise.sets.map((set, index) => `
          <div class="set">
            <div class="set-top">
              <span>${rx.setsGoal ? `Set ${index + 1} of ${esc(String(rx.setsGoal))}` : `Set ${index + 1}`}</span>
              <button class="btn danger small" data-act="del-set" data-ex="${exercise.id}" data-set="${set.id}">Delete</button>
            </div>
            ${renderSetControls(exercise, set)}
            <input class="field" placeholder="Set note" data-field="note" data-ex="${exercise.id}" data-set="${set.id}" value="${esc(set.note)}">
          </div>
        `).join("")}
        <div class="actions">
          <button class="btn wide" data-act="add-set" data-ex="${exercise.id}">+ Set</button>
        </div>
      </section>
    `;
  }
  html += `
    <textarea class="note" rows="3" placeholder="Session note" data-session="note">${esc(session.note)}</textarea>
    <div class="actions">
      <button class="btn wide" data-act="add-ex">Add exercise</button>
      ${done ? `<button class="btn primary wide" data-act="share">Copy / share for Might Guy</button>
        <button class="btn wide" data-act="resume">Reopen and edit</button>`
        : `<button class="btn primary wide" data-act="finish">Finish workout</button>
        <button class="btn wide" data-act="share">Copy what I have so far</button>`}
      <button class="btn danger wide" data-act="discard">Delete workout</button>
    </div>
  `;
  return html;
}

function render() {
  const app = document.getElementById("app");
  const y = window.scrollY;
  app.innerHTML = view === "session" ? renderSession() : renderHome();
  window.scrollTo(0, y);
  renderRest();
}

function registerWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

db = load();
if (db.restSec) rest.durationSec = db.restSec;
bind();
const restRoot = document.getElementById("rest-root");
if (restRoot) {
  restRoot.onclick = (event) => {
    const btn = event.target.closest("[data-act]");
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === "rest-preset") setRestDuration(Number(btn.dataset.sec));
    else if (act === "rest-start") startRest();
    else if (act === "rest-pause") pauseRest();
    else if (act === "rest-reset") resetRest();
    else if (act === "rest-plus") addRest(15);
    else if (act === "rest-minus") addRest(-15);
  };
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (rest.status === "running") {
    syncRest();
    requestWake();
  } else if (rest.status === "done") {
    renderRest();
  }
});
render();
registerWorker();
