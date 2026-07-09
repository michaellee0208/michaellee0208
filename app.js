const STORAGE_KEY = "construction-calendar-v1";

const defaultState = {
  activeSiteId: "site-1",
  sites: [{ id: "site-1", name: "預設案場" }],
  entries: [
    {
      id: crypto.randomUUID(),
      siteId: "site-1",
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      weather: "晴",
      color: "#176b5b",
      items: ["放樣及現場整備"],
      workers: [{ type: "工班", count: 3 }],
      note: "",
      createdAt: new Date().toISOString(),
    },
  ],
};

let state = loadState();
let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth();

const els = {
  siteSelect: document.querySelector("#siteSelect"),
  addSiteBtn: document.querySelector("#addSiteBtn"),
  yearInput: document.querySelector("#yearInput"),
  monthSelect: document.querySelector("#monthSelect"),
  prevMonthBtn: document.querySelector("#prevMonthBtn"),
  nextMonthBtn: document.querySelector("#nextMonthBtn"),
  todayBtn: document.querySelector("#todayBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  importFile: document.querySelector("#importFile"),
  workDaysCount: document.querySelector("#workDaysCount"),
  itemCount: document.querySelector("#itemCount"),
  workerCount: document.querySelector("#workerCount"),
  monthTitle: document.querySelector("#monthTitle"),
  calendarGrid: document.querySelector("#calendarGrid"),
  recordList: document.querySelector("#recordList"),
  addEntryBtn: document.querySelector("#addEntryBtn"),
  entryDialog: document.querySelector("#entryDialog"),
  dialogTitle: document.querySelector("#dialogTitle"),
  entryId: document.querySelector("#entryId"),
  startDateInput: document.querySelector("#startDateInput"),
  endDateInput: document.querySelector("#endDateInput"),
  weatherInput: document.querySelector("#weatherInput"),
  colorInput: document.querySelector("#colorInput"),
  itemsInput: document.querySelector("#itemsInput"),
  workersInput: document.querySelector("#workersInput"),
  noteInput: document.querySelector("#noteInput"),
  saveEntryBtn: document.querySelector("#saveEntryBtn"),
  deleteEntryBtn: document.querySelector("#deleteEntryBtn"),
  siteDialog: document.querySelector("#siteDialog"),
  siteNameInput: document.querySelector("#siteNameInput"),
  saveSiteBtn: document.querySelector("#saveSiteBtn"),
  toast: document.querySelector("#toast"),
};

for (let i = 0; i < 12; i += 1) {
  const option = document.createElement("option");
  option.value = String(i);
  option.textContent = `${i + 1} 月`;
  els.monthSelect.append(option);
}

bindEvents();
render();

function bindEvents() {
  els.siteSelect.addEventListener("change", () => {
    state.activeSiteId = els.siteSelect.value;
    saveState();
    render();
  });

  els.addSiteBtn.addEventListener("click", () => {
    els.siteNameInput.value = "";
    els.siteDialog.showModal();
    els.siteNameInput.focus();
  });

  els.saveSiteBtn.addEventListener("click", saveSite);

  els.yearInput.addEventListener("change", () => {
    const nextYear = Number(els.yearInput.value);
    if (Number.isInteger(nextYear) && nextYear >= 1900 && nextYear <= 2100) {
      viewYear = nextYear;
      render();
    }
  });

  els.monthSelect.addEventListener("change", () => {
    viewMonth = Number(els.monthSelect.value);
    render();
  });

  els.prevMonthBtn.addEventListener("click", () => stepMonth(-1));
  els.nextMonthBtn.addEventListener("click", () => stepMonth(1));

  els.todayBtn.addEventListener("click", () => {
    const now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();
    render();
  });

  els.addEntryBtn.addEventListener("click", () => openEntryDialog());
  els.saveEntryBtn.addEventListener("click", saveEntry);
  els.deleteEntryBtn.addEventListener("click", deleteEntry);
  els.exportBtn.addEventListener("click", exportBackup);
  els.importFile.addEventListener("change", importBackup);
}

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return structuredClone(defaultState);
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed.sites) || !Array.isArray(parsed.entries)) {
      return structuredClone(defaultState);
    }
    return {
      activeSiteId: parsed.activeSiteId || parsed.sites[0]?.id || "site-1",
      sites: parsed.sites.length ? parsed.sites : structuredClone(defaultState.sites),
      entries: parsed.entries.map(normalizeEntry),
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function render() {
  renderSites();
  els.yearInput.value = String(viewYear);
  els.monthSelect.value = String(viewMonth);
  els.monthTitle.textContent = `${viewYear} 年 ${viewMonth + 1} 月`;
  renderCalendar();
  renderSummary();
  renderRecords();
}

function renderSites() {
  els.siteSelect.innerHTML = "";
  state.sites.forEach((site) => {
    const option = document.createElement("option");
    option.value = site.id;
    option.textContent = site.name;
    els.siteSelect.append(option);
  });
  if (!state.sites.some((site) => site.id === state.activeSiteId)) {
    state.activeSiteId = state.sites[0]?.id || "site-1";
  }
  els.siteSelect.value = state.activeSiteId;
}

function renderCalendar() {
  els.calendarGrid.innerHTML = "";
  const firstDay = new Date(viewYear, viewMonth, 1);
  const start = new Date(viewYear, viewMonth, 1 - firstDay.getDay());
  const todayKey = toDateKey(new Date());

  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = toDateKey(date);
    const dayEntries = getEntriesForDate(key);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "day-cell";
    if (date.getMonth() !== viewMonth) cell.classList.add("outside");
    if (key === todayKey) cell.classList.add("today");
    cell.addEventListener("click", () => openEntryDialog(key, dayEntries[0]?.id));

    const weather = unique(dayEntries.map((entry) => entry.weather).filter(Boolean)).join(" / ");
    const bars = dayEntries.slice(0, 4);
    const workers = sumWorkers(dayEntries.flatMap((entry) => entry.workers));

    cell.innerHTML = `
      <div class="day-number">
        <span>${date.getDate()}</span>
        ${weather ? `<span class="weather-pill">${escapeHtml(weather)}</span>` : ""}
      </div>
      <div class="schedule-bars">
        ${bars.map((entry) => renderScheduleBar(entry, key)).join("")}
        ${dayEntries.length > 4 ? `<div class="more-line">另 ${dayEntries.length - 4} 筆</div>` : ""}
      </div>
      ${workers ? `<div class="worker-line">${escapeHtml(workers)}</div>` : ""}
    `;
    els.calendarGrid.append(cell);
  }
}

function renderSummary() {
  const entries = getMonthEntries();
  const dates = unique(entries.flatMap((entry) => datesInMonthForEntry(entry, viewYear, viewMonth)));
  const itemCount = entries.reduce((sum, entry) => sum + entry.items.length, 0);
  const workerCount = entries.reduce(
    (sum, entry) => sum + entry.workers.reduce((workerSum, worker) => workerSum + Number(worker.count || 0), 0),
    0,
  );
  els.workDaysCount.textContent = String(dates.length);
  els.itemCount.textContent = String(itemCount);
  els.workerCount.textContent = String(workerCount);
}

function renderRecords() {
  const entries = getMonthEntries();
  els.recordList.innerHTML = "";
  if (!entries.length) {
    els.recordList.innerHTML = `<div class="empty-state">本月尚無施工紀錄</div>`;
    return;
  }

  entries.forEach((entry) => {
    const card = document.createElement("article");
    card.className = "record-card";
    const workers = sumWorkers(entry.workers);
    card.innerHTML = `
      <div class="record-date">
        ${escapeHtml(formatEntryRange(entry))}<br>
        <span class="record-color" style="--entry-color:${escapeHtml(entry.color)}"></span>
        ${escapeHtml(entry.weather || "")}
      </div>
      <div class="record-body">
        <div class="record-items">${entry.items.map(escapeHtml).join("、") || "未填工項"}</div>
        <p>${escapeHtml(workers || "未填施工人員")}</p>
        ${entry.note ? `<p>${escapeHtml(entry.note)}</p>` : ""}
      </div>
      <button class="ghost-button" type="button">編輯</button>
    `;
    card.querySelector("button").addEventListener("click", () => openEntryDialog(entry.startDate, entry.id));
    els.recordList.append(card);
  });
}

function openEntryDialog(dateKey = toDateKey(new Date(viewYear, viewMonth, 1)), entryId = "") {
  const entry = state.entries.find((item) => item.id === entryId);
  els.dialogTitle.textContent = entry ? "編輯施工紀錄" : "新增施工紀錄";
  els.entryId.value = entry?.id || "";
  els.startDateInput.value = entry?.startDate || dateKey;
  els.endDateInput.value = entry?.endDate || entry?.startDate || dateKey;
  els.weatherInput.value = entry?.weather || "晴";
  els.colorInput.value = entry?.color || "#176b5b";
  els.itemsInput.value = entry?.items?.join("\n") || "";
  els.workersInput.value = entry?.workers?.map((worker) => `${worker.type} ${worker.count}`).join("\n") || "";
  els.noteInput.value = entry?.note || "";
  els.deleteEntryBtn.hidden = !entry;
  els.entryDialog.showModal();
  els.startDateInput.focus();
}

function saveEntry() {
  if (!els.startDateInput.value || !els.endDateInput.value) {
    showToast("請選擇起訖日期");
    return;
  }

  if (els.endDateInput.value < els.startDateInput.value) {
    showToast("結束日期不可早於起始日期");
    return;
  }

  const items = splitLines(els.itemsInput.value);
  const workers = parseWorkers(els.workersInput.value);
  const id = els.entryId.value || crypto.randomUUID();
  const existingIndex = state.entries.findIndex((entry) => entry.id === id);
  const payload = {
    id,
    siteId: state.activeSiteId,
    startDate: els.startDateInput.value,
    endDate: els.endDateInput.value,
    weather: els.weatherInput.value,
    color: els.colorInput.value,
    items,
    workers,
    note: els.noteInput.value.trim(),
    createdAt: existingIndex >= 0 ? state.entries[existingIndex].createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    state.entries[existingIndex] = payload;
  } else {
    state.entries.push(payload);
  }

  const nextDate = new Date(`${payload.startDate}T00:00:00`);
  viewYear = nextDate.getFullYear();
  viewMonth = nextDate.getMonth();
  saveState();
  els.entryDialog.close();
  render();
  showToast("施工紀錄已儲存");
}

function deleteEntry() {
  const id = els.entryId.value;
  if (!id) return;
  state.entries = state.entries.filter((entry) => entry.id !== id);
  saveState();
  els.entryDialog.close();
  render();
  showToast("施工紀錄已刪除");
}

function saveSite() {
  const name = els.siteNameInput.value.trim();
  if (!name) {
    showToast("請輸入案場名稱");
    return;
  }
  const site = { id: crypto.randomUUID(), name };
  state.sites.push(site);
  state.activeSiteId = site.id;
  saveState();
  els.siteDialog.close();
  render();
  showToast("案場已新增");
}

function exportBackup() {
  const data = {
    app: "工程月曆系統",
    version: 1,
    exportedAt: new Date().toISOString(),
    state,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  link.href = url;
  link.download = `工程月曆備份_${date}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("備份已匯出");
}

async function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const backup = JSON.parse(text);
    const imported = backup.state || backup;
    if (!Array.isArray(imported.sites) || !Array.isArray(imported.entries)) {
      throw new Error("Invalid backup");
    }
    state = {
      activeSiteId: imported.activeSiteId || imported.sites[0]?.id,
      sites: imported.sites,
      entries: imported.entries.map(normalizeEntry),
    };
    saveState();
    render();
    showToast("備份已匯入");
  } catch {
    showToast("匯入失敗，請確認檔案格式");
  } finally {
    event.target.value = "";
  }
}

function stepMonth(offset) {
  const next = new Date(viewYear, viewMonth + offset, 1);
  viewYear = next.getFullYear();
  viewMonth = next.getMonth();
  render();
}

function getMonthEntries() {
  return state.entries
    .filter((entry) => entry.siteId === state.activeSiteId && entryOverlapsMonth(entry, viewYear, viewMonth))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

function getEntriesForDate(dateKey) {
  return state.entries
    .filter((entry) => entry.siteId === state.activeSiteId && entry.startDate <= dateKey && entry.endDate >= dateKey)
    .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
}

function normalizeEntry(entry) {
  const startDate = entry.startDate || entry.date || new Date().toISOString().slice(0, 10);
  const endDate = entry.endDate || entry.date || startDate;
  return {
    ...entry,
    startDate,
    endDate: endDate < startDate ? startDate : endDate,
    color: entry.color || colorFromText((entry.items || ["工項"]).join("")),
    items: Array.isArray(entry.items) ? entry.items : [],
    workers: Array.isArray(entry.workers) ? entry.workers : [],
  };
}

function renderScheduleBar(entry, dateKey) {
  const title = entry.items[0] || "未填工項";
  const rangeClass = [
    entry.startDate === dateKey ? "start" : "",
    entry.endDate === dateKey ? "end" : "",
    entry.startDate < dateKey && entry.endDate > dateKey ? "middle" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `<div class="schedule-bar ${rangeClass}" style="--entry-color:${escapeHtml(entry.color)}" title="${escapeHtml(
    `${formatEntryRange(entry)} ${title}`,
  )}">${escapeHtml(title)}</div>`;
}

function entryOverlapsMonth(entry, year, month) {
  const monthStart = toDateKey(new Date(year, month, 1));
  const monthEnd = toDateKey(new Date(year, month + 1, 0));
  return entry.startDate <= monthEnd && entry.endDate >= monthStart;
}

function datesInMonthForEntry(entry, year, month) {
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const start = new Date(`${entry.startDate}T00:00:00`);
  const end = new Date(`${entry.endDate}T00:00:00`);
  const cursor = start > monthStart ? start : monthStart;
  const limit = end < monthEnd ? end : monthEnd;
  const dates = [];
  while (cursor <= limit) {
    dates.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function formatEntryRange(entry) {
  if (entry.startDate === entry.endDate) return entry.startDate;
  return `${entry.startDate} 至 ${entry.endDate}`;
}

function colorFromText(text) {
  const colors = ["#176b5b", "#1f6feb", "#b76e22", "#7c3aed", "#c2410c", "#0f766e"];
  const total = [...text].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return colors[total % colors.length];
}

function parseWorkers(value) {
  return splitLines(value).map((line) => {
    const match = line.match(/^(.*?)[\s,，:：]*(\d+(?:\.\d+)?)$/);
    if (!match) return { type: line, count: 0 };
    return { type: match[1].trim() || "人員", count: Number(match[2]) };
  });
}

function sumWorkers(workers) {
  const map = new Map();
  workers.forEach((worker) => {
    const type = worker.type || "人員";
    map.set(type, (map.get(type) || 0) + Number(worker.count || 0));
  });
  return [...map.entries()]
    .filter(([, count]) => count > 0)
    .map(([type, count]) => `${type} ${count}`)
    .join("、");
}

function splitLines(value) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function unique(items) {
  return [...new Set(items)];
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 1800);
}
