const STORAGE_KEY = "kanban-board:v1";
const THEME_KEY = "kanban-board:theme";
const TAGS = { design: "#a78bfa", dev: "#38bdf8", bug: "#f87171", client: "#fbbf24" };
const $ = (sel, root = document) => root.querySelector(sel);
const uid = () => Math.random().toString(36).slice(2, 10);

function demoBoard() {
  const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const cards = {};
  const add = (title, tag, desc = "", due = "") => { const id = uid(); cards[id] = { id, title, tag, desc, due }; return id; };
  return {
    cards,
    columns: [
      { id: "todo", title: "To do", color: "#8b949e", cards: [
        add("Write copy for the pricing section", "client", "Ask the client for real package names.", day(3)),
        add("Collect testimonials", "client"),
        add("Set up analytics", "dev", "", day(7)),
      ] },
      { id: "doing", title: "In progress", color: "#38bdf8", cards: [
        add("Hero animation", "design", "Logo reveal + scene transitions, respect reduced motion.", day(1)),
        add("Contact form → Telegram bot", "dev", "Webhook secret in env vars only."),
      ] },
      { id: "review", title: "Review", color: "#fbbf24", cards: [
        add("Mobile menu overlaps logo on 360px", "bug", "", day(-1)),
      ] },
      { id: "done", title: "Done", color: "#10b981", cards: [
        add("Buy domain", "client"),
        add("Logo variants", "design"),
      ] },
    ],
  };
}

let board = load() || demoBoard();
let filterTag = "";
let query = "";

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return data && Array.isArray(data.columns) ? data : null;
  } catch { return null; }
}
function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(board)); } catch { /* storage unavailable */ } }

// ---------- Theme ----------
function setTheme(t) { document.documentElement.dataset.theme = t; try { localStorage.setItem(THEME_KEY, t); } catch {} }
let storedTheme = null;
try { storedTheme = localStorage.getItem(THEME_KEY); } catch {}
setTheme(storedTheme || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));
$("#theme").addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));

// ---------- Rendering ----------
const boardEl = $("#board");

function dueInfo(due) {
  if (!due) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(due + "T00:00:00");
  const days = Math.round((d - today) / 864e5);
  const label = days === 0 ? "Today" : days === 1 ? "Tomorrow" : days === -1 ? "Yesterday" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return { label, cls: days < 0 ? "overdue" : days <= 1 ? "soon" : "" };
}

function matches(card) {
  if (filterTag && card.tag !== filterTag) return false;
  if (!query) return true;
  return (card.title + " " + card.desc).toLowerCase().includes(query);
}

function cardEl(card, column, colIndex) {
  const li = document.createElement("li");
  li.className = "card" + (column.id === "done" ? " is-done" : "");
  li.dataset.id = card.id;
  li.tabIndex = 0;
  li.setAttribute("aria-label", `${card.title}. Press Enter to edit, Shift + arrow keys to move.`);

  const title = document.createElement("p");
  title.className = "card-title";
  title.textContent = card.title;
  li.append(title);

  if (card.desc) {
    const desc = document.createElement("p");
    desc.className = "card-desc";
    desc.textContent = card.desc;
    li.append(desc);
  }

  const meta = document.createElement("div");
  meta.className = "meta";
  if (card.tag) {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.style.setProperty("--c", TAGS[card.tag]);
    tag.textContent = card.tag;
    meta.append(tag);
  }
  const due = dueInfo(card.due);
  if (due && column.id !== "done") {
    const span = document.createElement("span");
    span.className = `due ${due.cls}`;
    span.textContent = `⏰ ${due.label}`;
    meta.append(span);
  }
  if (meta.children.length) li.append(meta);

  const move = document.createElement("div");
  move.className = "card-move";
  if (colIndex > 0) move.innerHTML += `<button type="button" data-move="-1" aria-label="Move to ${board.columns[colIndex - 1].title}" tabindex="-1">←</button>`;
  if (colIndex < board.columns.length - 1) move.innerHTML += `<button type="button" data-move="1" aria-label="Move to ${board.columns[colIndex + 1].title}" tabindex="-1">→</button>`;
  li.append(move);
  return li;
}

function render() {
  const focusedId = document.activeElement?.closest?.(".card")?.dataset.id;
  boardEl.innerHTML = "";
  board.columns.forEach((column, colIndex) => {
    const section = document.createElement("section");
    section.className = "column";
    section.dataset.col = column.id;
    section.setAttribute("aria-labelledby", `h-${column.id}`);
    const visible = column.cards.map((id) => board.cards[id]).filter(Boolean).filter(matches);
    section.innerHTML = `
      <div class="col-head">
        <span class="col-dot" style="--dot:${column.color}"></span>
        <h2 id="h-${column.id}"></h2>
        <span class="count">${visible.length}</span>
      </div>`;
    $("h2", section).textContent = column.title;
    const ul = document.createElement("ul");
    ul.className = "cards";
    visible.forEach((card) => ul.append(cardEl(card, column, colIndex)));
    if (!visible.length) ul.innerHTML = `<li class="empty">${query || filterTag ? "No matching cards" : "Drop cards here"}</li>`;
    section.append(ul);
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "add-card";
    addBtn.textContent = "+ Add card";
    addBtn.addEventListener("click", () => quickAdd(section, column));
    section.append(addBtn);
    boardEl.append(section);
  });
  if (focusedId) $(`.card[data-id="${focusedId}"]`)?.focus();
}

function renderFilters() {
  const wrap = $("#filters");
  wrap.innerHTML = "";
  Object.entries(TAGS).forEach(([tag, color]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.style.setProperty("--c", color);
    b.textContent = tag[0].toUpperCase() + tag.slice(1);
    b.setAttribute("aria-pressed", String(filterTag === tag));
    b.addEventListener("click", () => { filterTag = filterTag === tag ? "" : tag; renderFilters(); render(); });
    wrap.append(b);
  });
}

// ---------- Mutations ----------
function findColumnOf(id) { return board.columns.find((c) => c.cards.includes(id)); }

function moveCard(id, toColId, index) {
  const from = findColumnOf(id);
  const to = board.columns.find((c) => c.id === toColId);
  if (!from || !to) return;
  from.cards.splice(from.cards.indexOf(id), 1);
  to.cards.splice(Math.max(0, Math.min(index ?? to.cards.length, to.cards.length)), 0, id);
  save(); render();
}

function quickAdd(section, column) {
  if ($(".quick", section)) return $(".quick textarea", section).focus();
  const wrap = document.createElement("div");
  wrap.className = "quick";
  wrap.innerHTML = '<textarea rows="2" placeholder="Card title — Enter to add, Esc to cancel" aria-label="New card title"></textarea>';
  section.insertBefore(wrap, $(".add-card", section));
  const ta = $("textarea", wrap);
  ta.focus();
  let closed = false;
  const close = () => { if (closed) return false; closed = true; wrap.remove(); return true; };
  const commit = () => {
    const title = ta.value.trim();
    if (!close()) return;
    if (!title) return;
    const id = uid();
    board.cards[id] = { id, title, desc: "", tag: filterTag, due: "" };
    column.cards.push(id);
    save(); render();
    toast(`Added “${title}”`);
  };
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commit(); }
    if (e.key === "Escape") close();
  });
  ta.addEventListener("blur", commit);
}

// ---------- Edit dialog ----------
const dialog = $("#dialog");
const cardForm = $("#card-form");
let editingId = null;

function openEditor(id) {
  const card = board.cards[id];
  if (!card) return;
  editingId = id;
  const sel = $("#column-select");
  sel.innerHTML = board.columns.map((c) => `<option value="${c.id}">${c.title}</option>`).join("");
  cardForm.title.value = card.title;
  cardForm.desc.value = card.desc;
  cardForm.tag.value = card.tag || "";
  cardForm.due.value = card.due || "";
  sel.value = findColumnOf(id).id;
  dialog.showModal();
  cardForm.title.select();
}
cardForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const card = board.cards[editingId];
  const title = cardForm.title.value.trim();
  if (!title) { cardForm.title.focus(); return; }
  Object.assign(card, { title, desc: cardForm.desc.value.trim(), tag: cardForm.tag.value, due: cardForm.due.value });
  dialog.close();
  if (findColumnOf(editingId).id !== cardForm.column.value) moveCard(editingId, cardForm.column.value);
  else { save(); render(); }
});
$("#cancel").addEventListener("click", () => dialog.close());
$("#delete").addEventListener("click", () => {
  const id = editingId;
  const col = findColumnOf(id);
  const index = col.cards.indexOf(id);
  const card = board.cards[id];
  col.cards.splice(index, 1);
  delete board.cards[id];
  dialog.close();
  save(); render();
  toast(`Deleted “${card.title}”`, () => {
    board.cards[id] = card;
    col.cards.splice(index, 0, id);
    save(); render();
  });
});

// ---------- Toast with undo ----------
let toastTimer;
function toast(message, undo) {
  const el = $("#toast");
  el.innerHTML = "";
  el.append(message);
  if (undo) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = "Undo";
    b.addEventListener("click", () => { undo(); el.classList.remove("show"); });
    el.append(b);
  }
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 4000);
}

// ---------- Pointer drag & drop (mouse, touch and pen) ----------
let drag = null;

boardEl.addEventListener("pointerdown", (e) => {
  const card = e.target.closest(".card");
  if (!card || e.button !== 0 || e.target.closest("button")) return;
  drag = { id: card.dataset.id, source: card, startX: e.clientX, startY: e.clientY, active: false };
});

addEventListener("pointermove", (e) => {
  if (!drag) return;
  if (!drag.active) {
    if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 6) return;
    startDrag(e);
  }
  drag.ghost.style.left = `${e.clientX - drag.offsetX}px`;
  drag.ghost.style.top = `${e.clientY - drag.offsetY}px`;
  positionPlaceholder(e.clientX, e.clientY);
  autoScroll(e.clientX);
});

function startDrag(e) {
  const rect = drag.source.getBoundingClientRect();
  drag.active = true;
  drag.offsetX = e.clientX - rect.left;
  drag.offsetY = e.clientY - rect.top;
  drag.ghost = drag.source.cloneNode(true);
  drag.ghost.classList.add("ghost");
  drag.ghost.style.width = `${rect.width}px`;
  document.body.append(drag.ghost);
  drag.placeholder = document.createElement("li");
  drag.placeholder.className = "placeholder";
  drag.placeholder.style.height = `${rect.height}px`;
  drag.source.after(drag.placeholder);
  drag.source.classList.add("dragging-source");
  drag.source.hidden = true;
  document.body.classList.add("is-dragging");
}

function positionPlaceholder(x, y) {
  const under = document.elementFromPoint(x, y);
  const column = under?.closest(".column");
  document.querySelectorAll(".column.drop-target").forEach((c) => c !== column && c.classList.remove("drop-target"));
  if (!column) return;
  column.classList.add("drop-target");
  const list = $(".cards", column);
  $(".empty", list)?.remove();
  const siblings = [...list.querySelectorAll(".card:not([hidden])")];
  const before = siblings.find((c) => { const r = c.getBoundingClientRect(); return y < r.top + r.height / 2; });
  if (before) list.insertBefore(drag.placeholder, before); else list.append(drag.placeholder);
}

function autoScroll(x) {
  const edge = 60;
  if (x < edge) boardEl.scrollLeft -= 12;
  else if (x > innerWidth - edge) boardEl.scrollLeft += 12;
}

function endDrag() {
  if (!drag) return;
  if (drag.active) {
    const column = drag.placeholder.closest(".column");
    const list = drag.placeholder.parentElement;
    drag.ghost.remove();
    document.body.classList.remove("is-dragging");
    if (column && list) {
      // index among the column's real cards (filtered view maps back to full order)
      let prev = drag.placeholder.previousElementSibling;
      while (prev && (!prev.classList.contains("card") || prev.dataset.id === drag.id)) prev = prev.previousElementSibling;
      const to = board.columns.find((c) => c.id === column.dataset.col);
      const from = findColumnOf(drag.id);
      from.cards.splice(from.cards.indexOf(drag.id), 1);
      const index = prev ? to.cards.indexOf(prev.dataset.id) + 1 : 0;
      to.cards.splice(index, 0, drag.id);
      save();
    }
    const id = drag.id;
    drag = null;
    render();
    $(`.card[data-id="${id}"]`)?.focus();
    return;
  }
  drag = null;
}
addEventListener("pointerup", endDrag);
addEventListener("pointercancel", endDrag);

// ---------- Clicks & keyboard ----------
boardEl.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-move]");
  if (!btn) return;
  const id = btn.closest(".card").dataset.id;
  const colIndex = board.columns.indexOf(findColumnOf(id));
  moveCard(id, board.columns[colIndex + Number(btn.dataset.move)].id, 0);
});
boardEl.addEventListener("dblclick", (e) => {
  const card = e.target.closest(".card");
  if (card) openEditor(card.dataset.id);
});
boardEl.addEventListener("keydown", (e) => {
  const card = e.target.closest(".card");
  if (!card || e.target !== card) return;
  const id = card.dataset.id;
  const col = findColumnOf(id);
  const colIndex = board.columns.indexOf(col);
  const index = col.cards.indexOf(id);
  if (e.key === "Enter") { e.preventDefault(); openEditor(id); }
  else if (e.shiftKey && e.key === "ArrowRight" && colIndex < board.columns.length - 1) { e.preventDefault(); moveCard(id, board.columns[colIndex + 1].id, 0); }
  else if (e.shiftKey && e.key === "ArrowLeft" && colIndex > 0) { e.preventDefault(); moveCard(id, board.columns[colIndex - 1].id, 0); }
  else if (e.shiftKey && e.key === "ArrowUp" && index > 0) { e.preventDefault(); moveCard(id, col.id, index - 1); }
  else if (e.shiftKey && e.key === "ArrowDown") { e.preventDefault(); moveCard(id, col.id, index + 1); }
  else if (e.key === "ArrowDown") { e.preventDefault(); card.nextElementSibling?.focus(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); card.previousElementSibling?.focus(); }
  else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); openEditor(id); }
});

addEventListener("keydown", (e) => {
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || dialog.open;
  if (typing) return;
  if (e.key === "/") { e.preventDefault(); $("#search").focus(); }
  if (e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    quickAdd($(".column"), board.columns[0]);
  }
});

$("#search").addEventListener("input", (e) => { query = e.target.value.trim().toLowerCase(); render(); });
$("#reset").addEventListener("click", () => {
  if (!confirm("Reset the board to the demo cards? Your changes will be lost.")) return;
  board = demoBoard(); save(); render();
});

renderFilters();
render();
