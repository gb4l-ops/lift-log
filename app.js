const STORAGE_KEY = "lift-log-v1";

const TEMPLATES = [
  {
    id: "upper-a",
    name: "Upper A",
    blurb: "Monday · about 60 min",
    exercises: [
      { name: "Neutral-grip DB incline press", kind: "reps", shoulder: true },
      { name: "Chest-supported or machine row", kind: "reps" },
      { name: "Landmine or single-arm cable press", kind: "reps", shoulder: true },
      { name: "Lat pulldown or assisted pull-up", kind: "reps" },
      { name: "Face pulls or rear-delt fly", kind: "reps" },
      { name: "Dead bug or plank", kind: "flex" }
    ]
  },
  {
    id: "lower",
    name: "Lower + core",
    blurb: "Saturday · about 60–75 min · no squats",
    exercises: [
      { name: "Leg press", kind: "reps" },
      { name: "Romanian deadlift", kind: "reps" },
      { name: "Bulgarian split squat or reverse lunge", kind: "reps" },
      { name: "Leg curl", kind: "reps" },
      { name: "Straight-knee calf raise", kind: "reps" },
      { name: "Hanging knee raise or captain's chair", kind: "reps", bodyweight: true },
      { name: "Cable crunch", kind: "reps" },
      { name: "Side plank", kind: "time", timeLabel: "sec", sided: true, bodyweight: true }
    ]
  },
  {
    id: "upper-b",
    name: "Upper B",
    blurb: "Sunday · about 60–75 min",
    exercises: [
      { name: "Neutral-grip machine chest press", kind: "reps", shoulder: true },
      { name: "One-arm DB or cable row", kind: "reps" },
      { name: "Face pulls", kind: "reps" },
      { name: "Lat pulldown (different grip than Monday)", kind: "reps" },
      { name: "Lateral raise", kind: "reps" },
      {
        name: "Curl + rope pushdown",
        kind: "superset",
        parts: ["Curl", "Rope pushdown"]
      },
      {
        name: "Suitcase hold (in place)",
        kind: "time",
        timeLabel: "sec",
        sided: true,
        hint: "2 x 30–40 seconds each side, no walking"
      }
    ]
  },
  {
    id: "extras",
    name: "Recovery extras",
    blurb: "Optional Tuesday / Thursday",
    exercises: [
      { name: "Band pull-aparts", kind: "reps", bodyweight: true },
      { name: "Face pulls", kind: "reps" },
      { name: "Dead bugs", kind: "flex", bodyweight: true },
      { name: "Side planks", kind: "time", timeLabel: "sec", sided: true, bodyweight: true },
      { name: "Easy bike", kind: "time", timeLabel: "min", bodyweight: true }
    ]
  },
  { id: "custom", name: "Custom", blurb: "Blank session", exercises: [] }
];

let db = { sessions: [] };
let view = "home";
let activeId = null;
let saveError = "";

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
    return parsed;
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
    lines.push(exercise.name);
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
    html += `
      <section class="card ex">
        <div class="ex-head">
          <div>
            <strong class="ex-name">${esc(exercise.name)}</strong>
            ${exercise.hint ? `<span class="meta">${esc(exercise.hint)}</span>` : ""}
          </div>
          <button class="btn danger small" data-act="del-ex" data-ex="${exercise.id}">Remove</button>
        </div>
        ${exercise.shoulder ? `<textarea class="note" rows="2" placeholder="How's the left shoulder?" data-field="exerciseNote" data-ex="${exercise.id}">${esc(exercise.exerciseNote)}</textarea>` : ""}
        ${exercise.sets.map((set, index) => `
          <div class="set">
            <div class="set-top">
              <span>Set ${index + 1}</span>
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
}

function registerWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

db = load();
bind();
render();
registerWorker();
