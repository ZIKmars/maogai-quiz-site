const LETTERS = ["A", "B", "C", "D", "E", "F"];

const state = {
  pool: [],
  index: 0,
  selected: new Set(),
  answered: new Map(),
  wrongIds: []
};

const el = {
  totalCount: document.querySelector("#totalCount"),
  singleCount: document.querySelector("#singleCount"),
  multipleCount: document.querySelector("#multipleCount"),
  typeFilter: document.querySelector("#typeFilter"),
  chapterFilter: document.querySelector("#chapterFilter"),
  limitSelect: document.querySelector("#limitSelect"),
  shuffleToggle: document.querySelector("#shuffleToggle"),
  startBtn: document.querySelector("#startBtn"),
  wrongBtn: document.querySelector("#wrongBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  doneCount: document.querySelector("#doneCount"),
  rightCount: document.querySelector("#rightCount"),
  scoreRate: document.querySelector("#scoreRate"),
  progressText: document.querySelector("#progressText"),
  tagRow: document.querySelector("#tagRow"),
  progressBar: document.querySelector("#progressBar"),
  questionView: document.querySelector("#questionView"),
  actions: document.querySelector("#actions"),
  submitBtn: document.querySelector("#submitBtn"),
  nextBtn: document.querySelector("#nextBtn"),
  finishBtn: document.querySelector("#finishBtn"),
  summary: document.querySelector("#summary")
};

function init() {
  const single = QUESTION_BANK.filter((q) => q.type === "single").length;
  const multiple = QUESTION_BANK.filter((q) => q.type === "multiple").length;
  el.totalCount.textContent = `${QUESTION_BANK.length} 题`;
  el.singleCount.textContent = `单选 ${single}`;
  el.multipleCount.textContent = `多选 ${multiple}`;

  const chapters = [...new Set(QUESTION_BANK.map((q) => q.chapter))];
  chapters.forEach((chapter) => {
    const option = document.createElement("option");
    option.value = chapter;
    option.textContent = chapter;
    el.chapterFilter.append(option);
  });

  el.startBtn.addEventListener("click", () => startPractice());
  el.wrongBtn.addEventListener("click", () => startWrongPractice());
  el.resetBtn.addEventListener("click", resetPractice);
  el.submitBtn.addEventListener("click", submitAnswer);
  el.nextBtn.addEventListener("click", nextQuestion);
  el.finishBtn.addEventListener("click", finishPractice);
}

function startPractice(seedPool) {
  const type = el.typeFilter.value;
  const chapter = el.chapterFilter.value;
  const limit = el.limitSelect.value;
  let pool = seedPool ? [...seedPool] : [...QUESTION_BANK];

  if (!seedPool && type !== "all") {
    pool = pool.filter((q) => q.type === type);
  }
  if (!seedPool && chapter !== "all") {
    pool = pool.filter((q) => q.chapter === chapter);
  }
  if (el.shuffleToggle.checked) {
    pool = shuffle(pool);
  }
  if (!seedPool && limit !== "all") {
    pool = pool.slice(0, Number(limit));
  }

  state.pool = pool;
  state.index = 0;
  state.selected.clear();
  state.answered.clear();
  el.summary.hidden = true;

  if (!pool.length) {
    renderEmpty("当前筛选条件下没有题目。");
    return;
  }

  el.actions.hidden = false;
  renderQuestion();
  updateStats();
}

function startWrongPractice() {
  const wrongPool = QUESTION_BANK.filter((q) => state.wrongIds.includes(q.id));
  if (wrongPool.length) {
    startPractice(wrongPool);
  }
}

function resetPractice() {
  state.pool = [];
  state.index = 0;
  state.selected.clear();
  state.answered.clear();
  state.wrongIds = [];
  el.wrongBtn.disabled = true;
  el.actions.hidden = true;
  el.summary.hidden = true;
  el.progressText.textContent = "准备开始";
  el.progressBar.style.width = "0%";
  el.tagRow.replaceChildren();
  renderEmpty("选择题型和章节后开始练习。");
  updateStats();
}

function renderQuestion() {
  const question = currentQuestion();
  const record = state.answered.get(question.id);
  state.selected = new Set(record ? record.selected : []);

  el.progressText.textContent = `第 ${state.index + 1} / ${state.pool.length} 题`;
  el.progressBar.style.width = `${((state.index + 1) / state.pool.length) * 100}%`;
  el.tagRow.replaceChildren(
    tag(question.type === "single" ? "单选" : "多选"),
    tag(question.chapter)
  );

  const form = document.createElement("form");
  form.className = "options";
  form.addEventListener("change", onChoiceChange);

  question.options.forEach((option, i) => {
    const label = document.createElement("label");
    label.className = "option";
    if (record) {
      if (question.answer.includes(i)) label.classList.add("correct");
      if (record.selected.includes(i) && !question.answer.includes(i)) label.classList.add("wrong");
    }

    const input = document.createElement("input");
    input.type = question.type === "single" ? "radio" : "checkbox";
    input.name = "choice";
    input.value = String(i);
    input.checked = state.selected.has(i);
    input.disabled = Boolean(record);

    const text = document.createElement("span");
    text.className = "optionText";
    text.textContent = `${LETTERS[i]}. ${option}`;

    label.append(input, text);
    form.append(label);
  });

  const stem = document.createElement("h2");
  stem.className = "questionStem";
  stem.textContent = question.prompt;

  const source = document.createElement("p");
  source.className = "sourceLine";
  source.textContent = `来源：${question.source}`;

  el.questionView.replaceChildren(stem, source, form);

  if (record) {
    el.questionView.append(renderExplain(question, record.correct));
  }

  el.submitBtn.hidden = Boolean(record);
  el.nextBtn.hidden = !record || state.index >= state.pool.length - 1;
  el.finishBtn.hidden = false;
}

function onChoiceChange(event) {
  const value = Number(event.target.value);
  const question = currentQuestion();
  if (question.type === "single") {
    state.selected = new Set([value]);
  } else if (event.target.checked) {
    state.selected.add(value);
  } else {
    state.selected.delete(value);
  }
}

function submitAnswer() {
  const question = currentQuestion();
  if (!question || !state.selected.size) {
    pulse(el.submitBtn);
    return;
  }
  const selected = [...state.selected].sort((a, b) => a - b);
  const correct = sameAnswer(selected, question.answer);
  state.answered.set(question.id, { selected, correct });
  renderQuestion();
  updateStats();
}

function nextQuestion() {
  if (state.index < state.pool.length - 1) {
    state.index += 1;
    state.selected.clear();
    renderQuestion();
  }
}

function finishPractice() {
  const records = [...state.answered.entries()];
  const correctCount = records.filter(([, item]) => item.correct).length;
  const answeredCount = records.length;
  const total = state.pool.length;
  const wrongQuestions = state.pool.filter((q) => {
    const record = state.answered.get(q.id);
    return !record || !record.correct;
  });

  state.wrongIds = wrongQuestions.map((q) => q.id);
  el.wrongBtn.disabled = state.wrongIds.length === 0;

  const grid = document.createElement("div");
  grid.className = "resultGrid";
  grid.append(
    metric(total, "本轮题数"),
    metric(answeredCount, "已提交"),
    metric(correctCount, "答对"),
    metric(`${total ? Math.round((correctCount / total) * 100) : 0}%`, "总得分率")
  );

  const title = document.createElement("h2");
  title.textContent = wrongQuestions.length ? "本轮复盘" : "全部答对";

  const note = document.createElement("p");
  note.textContent = wrongQuestions.length
    ? "未答或答错的题目如下。多选题按考试规则计算，少选、多选、错选均不得分。"
    : "本轮题目都答对了，可以切换章节继续抽练。";

  el.summary.replaceChildren(title, grid, note);
  if (wrongQuestions.length) {
    el.summary.append(renderReviewList(wrongQuestions));
  }
  el.summary.hidden = false;
  el.summary.scrollIntoView({ behavior: "smooth", block: "start" });
  updateStats();
}

function renderExplain(question, correct) {
  const box = document.createElement("div");
  box.className = "explain";
  const answerText = question.answer.map((i) => LETTERS[i]).join("、");
  box.innerHTML = `<strong>${correct ? "回答正确" : "回答错误"}</strong><br>正确答案：${answerText}<br>${escapeHtml(question.explanation)}`;
  return box;
}

function renderReviewList(questions) {
  const list = document.createElement("div");
  list.className = "reviewList";
  questions.forEach((question) => {
    const record = state.answered.get(question.id);
    const item = document.createElement("article");
    item.className = "reviewItem";
    const selected = record && record.selected.length
      ? record.selected.map((i) => LETTERS[i]).join("、")
      : "未答";
    const answer = question.answer.map((i) => LETTERS[i]).join("、");
    item.innerHTML = `
      <p class="reviewMeta">${question.type === "single" ? "单选" : "多选"} · ${escapeHtml(question.chapter)}</p>
      <p><strong>${escapeHtml(question.prompt)}</strong></p>
      <p>你的答案：${selected}；正确答案：${answer}</p>
      <p>${escapeHtml(question.explanation)}</p>
    `;
    list.append(item);
  });
  return list;
}

function renderEmpty(message) {
  const p = document.createElement("p");
  p.className = "emptyState";
  p.textContent = message;
  el.questionView.replaceChildren(p);
  el.tagRow.replaceChildren();
}

function updateStats() {
  const records = [...state.answered.values()];
  const done = records.length;
  const right = records.filter((item) => item.correct).length;
  el.doneCount.textContent = String(done);
  el.rightCount.textContent = String(right);
  el.scoreRate.textContent = `${done ? Math.round((right / done) * 100) : 0}%`;
}

function currentQuestion() {
  return state.pool[state.index];
}

function sameAnswer(a, b) {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

function tag(text) {
  const span = document.createElement("span");
  span.textContent = text;
  return span;
}

function metric(value, label) {
  const div = document.createElement("div");
  div.innerHTML = `<strong>${value}</strong><span>${label}</span>`;
  return div;
}

function shuffle(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pulse(node) {
  node.animate(
    [
      { transform: "translateX(0)" },
      { transform: "translateX(-4px)" },
      { transform: "translateX(4px)" },
      { transform: "translateX(0)" }
    ],
    { duration: 180, easing: "ease-out" }
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

init();
