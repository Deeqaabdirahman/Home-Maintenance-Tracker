// Home Maintenance Tracker - simple class prototype
const STORAGE_KEY = "hmt_tasks_v1";

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}
function todayISO() {
  const d = new Date();
  d.setHours(0,0,0,0);
  return d.toISOString().slice(0,10);
}
function parseISO(s){ const d = new Date(s + "T00:00:00"); d.setHours(0,0,0,0); return d; }
function formatShort(iso){
  const d = parseISO(iso);
  return d.toLocaleDateString(undefined, {month:"short", day:"numeric", year:"numeric"});
}
function addDays(iso, days){
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0,10);
}
function daysBetween(aISO, bISO){
  const a = parseISO(aISO), b = parseISO(bISO);
  return Math.round((b - a) / 86400000);
}

function loadTasks(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return [];
    const t = JSON.parse(raw);
    return Array.isArray(t) ? t : [];
  }catch{ return []; }
}
function saveTasks(tasks){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function getStatus(task){
  const tdy = todayISO();
  if(task.completed) return "completed";
  if(task.dueDate < tdy) return "overdue";
  const diff = daysBetween(tdy, task.dueDate);
  if(diff <= 14) return "upcoming";
  return "scheduled";
}

function recurrenceLabel(rec){
  if(rec === "none" || !rec) return "One-time";
  const n = Number(rec);
  if(n === 30) return "Every 30 days";
  if(n === 90) return "Every 90 days";
  if(n === 180) return "Every 6 months";
  if(n === 365) return "Annually";
  return `Every ${n} days`;
}

// Router (hash-based)
const pages = ["dashboard","add","tasks","calendar"];
function showPage(route){
  pages.forEach(r=>{
    const el = document.getElementById("page-"+r);
    if(el) el.classList.toggle("active", r===route);
  });
  document.querySelectorAll(".nav a").forEach(a=>{
    a.classList.toggle("active", a.dataset.route === route);
  });
}

function currentRoute(){
  const h = location.hash || "#/dashboard";
  const m = h.match(/^#\/(\w+)/);
  return (m && pages.includes(m[1])) ? m[1] : "dashboard";
}

// Dashboard render
function renderDashboard(tasks){
  const upcoming = tasks.filter(t=>!t.completed && getStatus(t)==="upcoming").sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
  const overdue  = tasks.filter(t=>!t.completed && getStatus(t)==="overdue").sort((a,b)=>a.dueDate.localeCompare(b.dueDate));

  const upEl = document.getElementById("upcoming-list");
  const odEl = document.getElementById("overdue-list");
  const upCount = document.getElementById("upcoming-count");
  const odCount = document.getElementById("overdue-count");

  upCount.textContent = upcoming.length;
  odCount.textContent = overdue.length;

  function itemHTML(t){
    const st = getStatus(t);
    const badgeClass = st==="overdue" ? "overdue" : st==="upcoming" ? "upcoming" : "ok";
    return `
      <div class="item">
        <div>
          <strong>${escapeHTML(t.name)}</strong>
          <div class="meta">${escapeHTML(t.category)}${t.location ? " • "+escapeHTML(t.location) : ""} • Due ${formatShort(t.dueDate)} • ${recurrenceLabel(t.recurrence)}</div>
        </div>
        <div class="badge ${badgeClass}">${st==="overdue"?"Overdue":"Upcoming"}</div>
      </div>`;
  }
  upEl.innerHTML = upcoming.length ? upcoming.map(itemHTML).join("") : `<div class="muted">No upcoming tasks. Add one!</div>`;
  odEl.innerHTML = overdue.length ? overdue.map(itemHTML).join("") : `<div class="muted">No overdue tasks 🎉</div>`;

  // KPIs
  document.getElementById("kpi-total").textContent = tasks.length;
  document.getElementById("kpi-upcoming").textContent = upcoming.length;
  document.getElementById("kpi-overdue").textContent = overdue.length;
}

// Task list render
function renderTaskList(tasks){
  const search = (document.getElementById("search")?.value || "").trim().toLowerCase();
  const filter = document.getElementById("filter")?.value || "all";
  const sortBy = document.getElementById("sort")?.value || "dueDate";

  let rows = [...tasks];

  // filter
  if(search){
    rows = rows.filter(t=>
      (t.name||"").toLowerCase().includes(search) ||
      (t.category||"").toLowerCase().includes(search) ||
      (t.location||"").toLowerCase().includes(search) ||
      (t.notes||"").toLowerCase().includes(search)
    );
  }
  if(filter !== "all"){
    rows = rows.filter(t=>getStatus(t)===filter);
  }

  // sort
  rows.sort((a,b)=>{
    if(sortBy==="name") return (a.name||"").localeCompare(b.name||"");
    if(sortBy==="category") return (a.category||"").localeCompare(b.category||"");
    return (a.dueDate||"").localeCompare(b.dueDate||"");
  });

  const table = document.getElementById("task-table");
  if(!table) return;

  const head = `
    <div class="rowh">
      <div></div>
      <div>Task</div>
      <div>Due</div>
      <div>Recurrence</div>
      <div>Status</div>
      <div style="text-align:right">Actions</div>
    </div>`;

  const body = rows.map(t=>{
    const st = getStatus(t);
    const badgeClass = st==="overdue" ? "overdue" : st==="upcoming" ? "upcoming" : st==="completed" ? "ok" : "badge";
    const statusText = st[0].toUpperCase()+st.slice(1);
    return `
      <div class="row">
        <div><input class="cb" type="checkbox" ${t.completed ? "checked" : ""} data-action="toggle" data-id="${t.id}"></div>
        <div>
          <div class="name">${escapeHTML(t.name)}</div>
          <div class="sub">${escapeHTML(t.category)}${t.location ? " • "+escapeHTML(t.location) : ""}${t.notes ? " • "+escapeHTML(t.notes) : ""}</div>
        </div>
        <div>${formatShort(t.dueDate)}</div>
        <div>${recurrenceLabel(t.recurrence)}</div>
        <div><span class="badge ${badgeClass}">${statusText}</span></div>
        <div class="actions">
          <button class="btn ghost" data-action="edit" data-id="${t.id}">Edit</button>
          <button class="btn danger" data-action="delete" data-id="${t.id}">Delete</button>
        </div>
      </div>`;
  }).join("");

  table.innerHTML = head + (rows.length ? body : `<div style="padding:14px" class="muted">No tasks yet. Click “+ Add Task”.</div>`);
}

function escapeHTML(s){
  return String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Calendar
let calYear, calMonth; // month 0-11
function initCalendar(){
  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();
}

function renderCalendar(tasks){
  const cal = document.getElementById("calendar");
  if(!cal) return;

  const monthName = new Date(calYear, calMonth, 1).toLocaleDateString(undefined, {month:"long", year:"numeric"});
  document.getElementById("cal-month").textContent = monthName;

  const firstDay = new Date(calYear, calMonth, 1);
  const startDow = (firstDay.getDay() + 6) % 7; // make Monday=0
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();

  const cells = [];
  const totalCells = 42;
  for(let i=0;i<totalCells;i++){
    const dayNum = i - startDow + 1;
    if(dayNum < 1 || dayNum > daysInMonth){
      cells.push(`<div class="cal-cell"><div class="cal-day"><span class="muted"> </span><span></span></div></div>`);
      continue;
    }
    const iso = new Date(calYear, calMonth, dayNum).toISOString().slice(0,10);
    const todays = todayISO();
    const dayTasks = tasks
      .filter(t=>!t.completed && t.dueDate === iso)
      .sort((a,b)=>a.name.localeCompare(b.name));

    const pills = dayTasks.slice(0,3).map(t=>{
      const st = getStatus(t);
      const cls = st==="overdue" ? "task-pill overdue" : "task-pill";
      return `<div class="${cls}" data-action="open" data-id="${t.id}">${escapeHTML(t.name)}</div>`;
    }).join("");

    const more = dayTasks.length > 3 ? `<div class="muted small">+${dayTasks.length-3} more</div>` : "";
    const right = iso === todays ? `<span class="badge ok">Today</span>` : "";
    cells.push(`
      <div class="cal-cell">
        <div class="cal-day"><span>${dayNum}</span>${right}</div>
        <div class="cal-tasks">${pills}${more}</div>
      </div>
    `);
  }

  cal.innerHTML = `
    <div class="muted small" style="margin-bottom:8px">Mon • Tue • Wed • Thu • Fri • Sat • Sun</div>
    <div class="cal-grid">${cells.join("")}</div>
  `;
}

// Overlay (calendar task details)
let overlayTaskId = null;
function openOverlay(task){
  overlayTaskId = task.id;
  const st = getStatus(task);
  document.getElementById("ov-title").textContent = task.name;
  document.getElementById("ov-sub").textContent = `${task.category}${task.location ? " • "+task.location : ""}`;
  document.getElementById("ov-body").innerHTML = `
    <div><strong>Due:</strong> ${formatShort(task.dueDate)}</div>
    <div><strong>Recurrence:</strong> ${recurrenceLabel(task.recurrence)}</div>
    ${task.notes ? `<div><strong>Notes:</strong> ${escapeHTML(task.notes)}</div>` : ""}
    <div><strong>Status:</strong> ${st}</div>
  `;
  document.getElementById("overlay").classList.remove("hidden");
}
function closeOverlay(){
  overlayTaskId = null;
  document.getElementById("overlay").classList.add("hidden");
}

// CRUD
function addTask(task){
  const tasks = loadTasks();
  tasks.push(task);
  saveTasks(tasks);
}
function updateTask(id, patch){
  const tasks = loadTasks();
  const idx = tasks.findIndex(t=>t.id===id);
  if(idx === -1) return;
  tasks[idx] = {...tasks[idx], ...patch};
  saveTasks(tasks);
}
function deleteTask(id){
  const tasks = loadTasks().filter(t=>t.id!==id);
  saveTasks(tasks);
}

function toggleComplete(id){
  const tasks = loadTasks();
  const t = tasks.find(x=>x.id===id);
  if(!t) return;

  // If marking complete and recurring, reschedule next due date and mark completed timestamp
  if(!t.completed){
    const rec = t.recurrence || "none";
    const completedAt = todayISO();
    if(rec !== "none"){
      const next = addDays(t.dueDate < completedAt ? completedAt : t.dueDate, Number(rec));
      t.dueDate = next;
      t.lastCompleted = completedAt;
      t.completed = false; // keep active for recurring tasks
    }else{
      t.completed = true;
      t.lastCompleted = completedAt;
    }
  }else{
    // un-complete (only for one-time tasks)
    t.completed = false;
  }

  saveTasks(tasks);
}

function seedSampleTasks(){
  const tasks = loadTasks();
  if(tasks.length) return; // don't spam
  const tdy = todayISO();
  const sample = [
    {id:uid(), name:"Replace air filter", category:"HVAC", location:"Hallway", dueDate:addDays(tdy, 5), recurrence:"90", notes:"20x20x1", completed:false},
    {id:uid(), name:"Test smoke/CO detectors", category:"Safety", location:"Bedrooms", dueDate:addDays(tdy, -3), recurrence:"30", notes:"Press test button", completed:false},
    {id:uid(), name:"Clean fridge water filter", category:"Appliances", location:"Kitchen", dueDate:addDays(tdy, 12), recurrence:"180", notes:"Check model number", completed:false},
    {id:uid(), name:"Trash pickup", category:"Trash", location:"Front", dueDate:addDays(tdy, 2), recurrence:"30", notes:"Put bins out night before", completed:false},
  ];
  saveTasks(sample);
}

// Event wiring
function wire(){
  window.addEventListener("hashchange", renderAll);

  // Add task form
  const form = document.getElementById("task-form");
  if(form){
    form.addEventListener("submit", (e)=>{
      e.preventDefault();
      const fd = new FormData(form);
      const task = {
        id: uid(),
        name: (fd.get("name")||"").toString().trim(),
        category: (fd.get("category")||"Other").toString(),
        location: (fd.get("location")||"").toString().trim(),
        dueDate: (fd.get("dueDate")||"").toString(),
        recurrence: (fd.get("recurrence")||"none").toString(),
        notes: (fd.get("notes")||"").toString().trim(),
        completed: false,
        lastCompleted: null,
      };
      if(!task.name || !task.dueDate){
        alert("Please add a task name and due date.");
        return;
      }
      addTask(task);
      form.reset();
      location.hash = "#/tasks";
    });

    document.getElementById("seed-btn")?.addEventListener("click", ()=>{
      seedSampleTasks();
      renderAll();
      alert("Sample tasks added!");
    });

    // default due date today + 7
    const due = form.querySelector('input[name="dueDate"]');
    if(due && !due.value){
      due.value = addDays(todayISO(), 7);
    }
  }

  // Task list controls
  ["search","filter","sort"].forEach(id=>{
    document.getElementById(id)?.addEventListener("input", renderAll);
    document.getElementById(id)?.addEventListener("change", renderAll);
  });

  document.getElementById("task-table")?.addEventListener("click", (e)=>{
    const btn = e.target.closest("[data-action]");
    if(!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if(action==="delete"){
      if(confirm("Delete this task?")) deleteTask(id);
      renderAll();
    }
    if(action==="edit"){
      // simple edit: route to add page and prefill form
      const tasks = loadTasks();
      const t = tasks.find(x=>x.id===id);
      if(!t) return;
      location.hash = "#/add";
      setTimeout(()=>prefillForm(t), 0);
    }
  });

  document.getElementById("task-table")?.addEventListener("change", (e)=>{
    const cb = e.target.closest('input[data-action="toggle"]');
    if(!cb) return;
    toggleComplete(cb.dataset.id);
    renderAll();
  });

  document.getElementById("clear-completed")?.addEventListener("click", ()=>{
    const tasks = loadTasks().filter(t=>!t.completed);
    saveTasks(tasks);
    renderAll();
  });

  document.getElementById("export-json")?.addEventListener("click", ()=>{
    const data = JSON.stringify(loadTasks(), null, 2);
    const blob = new Blob([data], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "home-maintenance-tasks.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("import-json")?.addEventListener("change", async (e)=>{
    const file = e.target.files?.[0];
    if(!file) return;
    const text = await file.text();
    try{
      const data = JSON.parse(text);
      if(!Array.isArray(data)) throw new Error("Invalid format");
      // minimal validation
      const cleaned = data.map(t=>({
        id: t.id || uid(),
        name: String(t.name||"Untitled"),
        category: String(t.category||"Other"),
        location: String(t.location||""),
        dueDate: String(t.dueDate||todayISO()),
        recurrence: String(t.recurrence||"none"),
        notes: String(t.notes||""),
        completed: Boolean(t.completed),
        lastCompleted: t.lastCompleted || null,
      }));
      saveTasks(cleaned);
      alert("Imported tasks!");
      renderAll();
    }catch{
      alert("Could not import JSON. Make sure it’s a valid tasks file.");
    }finally{
      e.target.value = "";
    }
  });

  // Calendar controls
  document.getElementById("cal-prev")?.addEventListener("click", ()=>{
    calMonth -= 1;
    if(calMonth < 0){ calMonth = 11; calYear -= 1; }
    renderAll();
  });
  document.getElementById("cal-next")?.addEventListener("click", ()=>{
    calMonth += 1;
    if(calMonth > 11){ calMonth = 0; calYear += 1; }
    renderAll();
  });

  document.getElementById("calendar")?.addEventListener("click", (e)=>{
    const pill = e.target.closest('[data-action="open"]');
    if(!pill) return;
    const id = pill.dataset.id;
    const task = loadTasks().find(t=>t.id===id);
    if(task) openOverlay(task);
  });

  document.getElementById("ov-close")?.addEventListener("click", closeOverlay);
  document.getElementById("overlay")?.addEventListener("click", (e)=>{
    if(e.target.id==="overlay") closeOverlay();
  });
  document.getElementById("ov-complete")?.addEventListener("click", ()=>{
    if(!overlayTaskId) return;
    toggleComplete(overlayTaskId);
    closeOverlay();
    renderAll();
  });
  document.getElementById("ov-delete")?.addEventListener("click", ()=>{
    if(!overlayTaskId) return;
    if(confirm("Delete this task?")){
      deleteTask(overlayTaskId);
      closeOverlay();
      renderAll();
    }
  });
}

function prefillForm(task){
  const form = document.getElementById("task-form");
  if(!form) return;
  form.querySelector('input[name="name"]').value = task.name || "";
  form.querySelector('select[name="category"]').value = task.category || "Other";
  form.querySelector('input[name="location"]').value = task.location || "";
  form.querySelector('input[name="dueDate"]').value = task.dueDate || todayISO();
  form.querySelector('select[name="recurrence"]').value = task.recurrence || "none";
  form.querySelector('input[name="notes"]').value = task.notes || "";

  // Replace submit behavior for edit (one-time)
  const onSubmit = (e)=>{
    e.preventDefault();
    const fd = new FormData(form);
    updateTask(task.id, {
      name: (fd.get("name")||"").toString().trim(),
      category: (fd.get("category")||"Other").toString(),
      location: (fd.get("location")||"").toString().trim(),
      dueDate: (fd.get("dueDate")||"").toString(),
      recurrence: (fd.get("recurrence")||"none").toString(),
      notes: (fd.get("notes")||"").toString().trim(),
    });
    // restore normal submit
    form.removeEventListener("submit", onSubmit);
    form.reset();
    location.hash = "#/tasks";
  };

  // remove existing submit listeners? (we can't easily) — instead, temporarily intercept
  form.addEventListener("submit", onSubmit, {once:true});
}

function renderAll(){
  const route = currentRoute();
  showPage(route);
  const tasks = loadTasks();

  // If totally empty, give users sample tasks on first visit
  if(tasks.length === 0 && route !== "add"){
    // do nothing (user may want blank), but keep dashboard helpful
  }

  renderDashboard(tasks);
  renderTaskList(tasks);
  renderCalendar(tasks);
}

initCalendar();
wire();
renderAll();
