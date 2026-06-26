const EXAM_SECONDS = 20 * 60;
const WARNING_SECONDS = 5 * 60;
const MAX_WARNINGS = 3;
const ADMIN_PASSWORD = "MTS@2026";
const QUESTIONS_KEY = "mts_static_questions";
const DRAFT_KEY = "mts_static_exam_draft";
const RESULTS_KEY = "mts_static_results";

const state = {
  studentName: "",
  rollNumber: "",
  questions: [],
  answers: {},
  index: 0,
  startedAt: null,
  endTime: null,
  remaining: EXAM_SECONDS,
  timerId: null,
  warnings: 0,
  submitted: false,
  latestResult: null
};

const screens = {
  login: document.getElementById("loginScreen"),
  instructions: document.getElementById("instructionsScreen"),
  exam: document.getElementById("examScreen"),
  result: document.getElementById("resultScreen"),
  admin: document.getElementById("adminScreen")
};

function getQuestionBank() {
  const saved = JSON.parse(localStorage.getItem(QUESTIONS_KEY) || "null");
  return Array.isArray(saved) && saved.length ? saved : DEFAULT_QUESTIONS;
}

function saveQuestionBank(questions) {
  localStorage.setItem(QUESTIONS_KEY, JSON.stringify(questions));
}

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove("active"));
  screens[name].classList.add("active");
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value || "";
  return div.innerHTML;
}

function normalize(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.getElementById("toastRegion").appendChild(toast);
  setTimeout(() => toast.remove(), 3600);
}

function renderInstructionStats() {
  const count = getQuestionBank().length;
  document.getElementById("totalQuestions").textContent = count;
  document.getElementById("totalMarks").textContent = count;
}

function prepareExamQuestions() {
  return shuffle(getQuestionBank()).map((question) => ({
    ...question,
    options: shuffle(question.options || [])
  }));
}

function login(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.studentName = String(form.get("studentName") || "").trim();
  state.rollNumber = String(form.get("rollNumber") || "").trim();
  if (!state.studentName || !state.rollNumber) {
    showToast("Student name and roll number are required.", "error");
    return;
  }
  document.getElementById("candidateInfo").textContent = `${state.studentName} - Roll No: ${state.rollNumber}`;
  renderInstructionStats();
  showScreen("instructions");
}

function startExam() {
  state.questions = prepareExamQuestions();
  state.answers = {};
  state.index = 0;
  state.startedAt = new Date().toISOString();
  state.endTime = Date.now() + EXAM_SECONDS * 1000;
  state.remaining = EXAM_SECONDS;
  state.warnings = 0;
  state.submitted = false;
  showScreen("exam");
  renderQuestion();
  saveDraft();
  startTimer();
  document.documentElement.requestFullscreen?.().catch(() => showToast("Fullscreen blocked by browser.", "warning"));
}

function saveDraft() {
  if (state.submitted || !state.questions.length) return;
  localStorage.setItem(DRAFT_KEY, JSON.stringify({
    studentName: state.studentName,
    rollNumber: state.rollNumber,
    questions: state.questions,
    answers: state.answers,
    index: state.index,
    startedAt: state.startedAt,
    endTime: state.endTime,
    warnings: state.warnings
  }));
  document.getElementById("saveStatus").textContent = "Saved";
}

function renderQuestion() {
  const question = state.questions[state.index];
  const total = state.questions.length;
  document.getElementById("questionCounter").textContent = `Question ${state.index + 1} of ${total}`;
  document.getElementById("progressBar").style.width = `${((state.index + 1) / total) * 100}%`;
  document.getElementById("warningCount").textContent = `Warnings: ${state.warnings}/${MAX_WARNINGS}`;
  document.getElementById("prevButton").disabled = state.index === 0;
  document.getElementById("nextButton").style.display = state.index === total - 1 ? "none" : "inline-flex";
  document.getElementById("submitButton").style.display = state.index === total - 1 ? "inline-flex" : "none";

  const selected = state.answers[question.id] || "";
  document.getElementById("questionCard").innerHTML = `
    <span class="subject-pill">${escapeHtml(question.subject || "Science")}</span>
    <h3>${escapeHtml(question.question)}</h3>
    ${(question.options || []).map((option) => `
      <label class="option ${selected === option ? "active" : ""}">
        <input type="radio" name="answer" value="${escapeHtml(option)}" ${selected === option ? "checked" : ""}>
        <span>${escapeHtml(option)}</span>
      </label>
    `).join("")}
  `;

  document.querySelectorAll("input[name='answer']").forEach((input) => {
    input.addEventListener("change", () => {
      state.answers[question.id] = input.value;
      document.getElementById("saveStatus").textContent = "Saving...";
      setTimeout(() => {
        saveDraft();
        renderQuestion();
      }, 120);
    });
  });
}

function moveQuestion(direction) {
  const next = state.index + direction;
  if (next < 0 || next >= state.questions.length) return;
  state.index = next;
  saveDraft();
  renderQuestion();
}

function clearAnswer() {
  const question = state.questions[state.index];
  delete state.answers[question.id];
  saveDraft();
  renderQuestion();
}

function startTimer() {
  clearInterval(state.timerId);
  updateTimer();
  state.timerId = setInterval(updateTimer, 1000);
}

function updateTimer() {
  state.remaining = Math.max(0, Math.ceil((state.endTime - Date.now()) / 1000));
  const minutes = Math.floor(state.remaining / 60);
  const seconds = state.remaining % 60;
  const timer = document.getElementById("timer");
  timer.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  timer.classList.toggle("warning", state.remaining <= WARNING_SECONDS);
  if (state.remaining <= 0) submitExam(true);
}

function evaluateExam() {
  const review = state.questions.map((question) => {
    const selectedAnswer = state.answers[question.id] || "";
    const isCorrect = normalize(selectedAnswer) === normalize(question.correctAnswer);
    return {
      ...question,
      selectedAnswer,
      isSkipped: !selectedAnswer,
      isCorrect: Boolean(selectedAnswer) && isCorrect
    };
  });
  const correct = review.filter((item) => item.isCorrect).length;
  const skipped = review.filter((item) => item.isSkipped).length;
  const wrong = review.length - correct - skipped;
  const percentage = review.length ? Math.round((correct / review.length) * 100) : 0;
  const submittedAt = new Date().toISOString();
  const timeTakenSeconds = Math.max(0, Math.round((new Date(submittedAt) - new Date(state.startedAt)) / 1000));
  return {
    studentName: state.studentName,
    rollNumber: state.rollNumber,
    total: review.length,
    obtained: correct,
    correct,
    wrong,
    skipped,
    percentage,
    status: percentage >= 50 ? "Pass" : "Fail",
    timeTaken: formatDuration(timeTakenSeconds),
    submittedAt,
    review
  };
}

function submitExam(auto = false) {
  if (state.submitted) return;
  if (!auto && !confirm("Submit exam now?")) return;
  state.submitted = true;
  clearInterval(state.timerId);
  const result = evaluateExam();
  state.latestResult = result;
  const stored = JSON.parse(localStorage.getItem(RESULTS_KEY) || "[]");
  stored.unshift(result);
  localStorage.setItem(RESULTS_KEY, JSON.stringify(stored.slice(0, 100)));
  localStorage.removeItem(DRAFT_KEY);
  renderResult(result);
  showScreen("result");
}

function renderResult(result) {
  document.getElementById("resultName").textContent = result.studentName;
  document.getElementById("resultMeta").textContent = `Roll No: ${result.rollNumber} - Time Taken: ${result.timeTaken}`;
  document.getElementById("passStatus").textContent = result.status;
  document.getElementById("passStatus").classList.toggle("fail", result.status !== "Pass");
  document.getElementById("resultTotal").textContent = result.total;
  document.getElementById("resultObtained").textContent = result.obtained;
  document.getElementById("resultCorrect").textContent = result.correct;
  document.getElementById("resultWrong").textContent = result.wrong;
  document.getElementById("resultPercent").textContent = `${result.percentage}%`;

  document.getElementById("reviewList").innerHTML = result.review.map((item, index) => `
    <article class="card review-item ${item.isCorrect ? "correct" : ""}">
      <div class="review-title">
        <strong>Question ${index + 1}</strong>
        <span>${item.isCorrect ? "Correct" : item.isSkipped ? "Skipped" : "Wrong"}</span>
      </div>
      <p><strong>${escapeHtml(item.question)}</strong></p>
      <p class="muted">Your answer: <strong>${escapeHtml(item.selectedAnswer || "Not answered")}</strong></p>
      <p class="muted">Correct answer: <strong>${escapeHtml(item.correctAnswer)}</strong></p>
      <p class="muted">${escapeHtml(item.explanation)}</p>
    </article>
  `).join("");
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}m ${String(rest).padStart(2, "0")}s`;
}

function resultLines(filter) {
  const result = state.latestResult;
  const items = filter ? result.review.filter(filter) : result.review;
  return [
    "Moro Testing Service (MTS) - Science Exam Result",
    `Student: ${result.studentName}`,
    `Roll Number: ${result.rollNumber}`,
    `Total Marks: ${result.total}`,
    `Obtained Marks: ${result.obtained}`,
    `Correct: ${result.correct}`,
    `Wrong: ${result.wrong}`,
    `Percentage: ${result.percentage}%`,
    `Status: ${result.status}`,
    `Time Taken: ${result.timeTaken}`,
    "",
    ...items.flatMap((item, index) => [
      `${index + 1}. ${item.question}`,
      `Your answer: ${item.selectedAnswer || "Not answered"}`,
      `Correct answer: ${item.correctAnswer}`,
      `Explanation: ${item.explanation}`,
      ""
    ])
  ];
}

function downloadText(filename, lines) {
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadPdf() {
  const commands = resultLines().slice(0, 58).map((line, index) => {
    const safe = String(line).replace(/[()\\]/g, "\\$&").slice(0, 100);
    return `BT /F1 9 Tf 42 ${790 - index * 13} Td (${safe}) Tj ET`;
  }).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "mts-full-result.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function securityWarning(reason) {
  if (!screens.exam.classList.contains("active") || state.submitted) return;
  state.warnings += 1;
  document.getElementById("warningCount").textContent = `Warnings: ${state.warnings}/${MAX_WARNINGS}`;
  showToast(`${reason}. Warning ${state.warnings}/${MAX_WARNINGS}`, "warning");
  saveDraft();
  if (state.warnings >= MAX_WARNINGS) submitExam(true);
}

function installSecurityControls() {
  ["copy", "cut", "paste", "contextmenu"].forEach((eventName) => {
    document.addEventListener(eventName, (event) => {
      if (screens.exam.classList.contains("active")) {
        event.preventDefault();
        showToast("Exam security restriction is active.", "warning");
      }
    });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) securityWarning("Tab switching detected");
  });
  window.addEventListener("beforeunload", (event) => {
    if (screens.exam.classList.contains("active") && !state.submitted) {
      event.preventDefault();
      event.returnValue = "Exam is running.";
    }
  });
}

function openAdminIfNeeded() {
  if (new URLSearchParams(location.search).get("admin") === "1") showScreen("admin");
}

function adminLogin(event) {
  event.preventDefault();
  if (document.getElementById("adminPassword").value !== ADMIN_PASSWORD) {
    showToast("Wrong admin password.", "error");
    return;
  }
  document.getElementById("adminLoginForm").style.display = "none";
  document.getElementById("adminDashboard").classList.add("active");
  renderAdminQuestions();
}

function resetAdminForm() {
  document.getElementById("questionForm").reset();
  document.getElementById("editingId").value = "";
  document.getElementById("adminSubject").value = "Science";
  document.getElementById("adminFormTitle").textContent = "Add Question";
}

function saveAdminQuestion(event) {
  event.preventDefault();
  const questions = getQuestionBank();
  const id = document.getElementById("editingId").value || `Q-${Date.now()}`;
  const options = Array.from(document.querySelectorAll(".option-input")).map((input) => input.value.trim()).filter(Boolean);
  const question = {
    id,
    type: "mcq",
    question: document.getElementById("adminQuestion").value.trim(),
    options,
    correctAnswer: document.getElementById("adminAnswer").value.trim(),
    explanation: document.getElementById("adminExplanation").value.trim(),
    subject: document.getElementById("adminSubject").value.trim() || "Science"
  };
  const next = questions.some((item) => item.id === id)
    ? questions.map((item) => item.id === id ? question : item)
    : [...questions, question];
  saveQuestionBank(next);
  resetAdminForm();
  renderAdminQuestions();
  renderInstructionStats();
  showToast("Question saved.", "success");
}

function renderAdminQuestions() {
  const list = document.getElementById("adminQuestionList");
  list.innerHTML = getQuestionBank().map((question) => `
    <article class="admin-question">
      <strong>${escapeHtml(question.question)}</strong>
      <p class="muted">Answer: ${escapeHtml(question.correctAnswer)} - ${escapeHtml(question.subject)}</p>
      <div class="actions left">
        <button class="btn btn-outline" type="button" data-edit="${question.id}">Edit</button>
        <button class="btn btn-danger" type="button" data-delete="${question.id}">Delete</button>
      </div>
    </article>
  `).join("");
  list.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => editQuestion(button.dataset.edit)));
  list.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => deleteQuestion(button.dataset.delete)));
}

function editQuestion(id) {
  const question = getQuestionBank().find((item) => item.id === id);
  if (!question) return;
  document.getElementById("editingId").value = question.id;
  document.getElementById("adminQuestion").value = question.question;
  document.getElementById("adminAnswer").value = question.correctAnswer;
  document.getElementById("adminExplanation").value = question.explanation || "";
  document.getElementById("adminSubject").value = question.subject || "Science";
  document.querySelectorAll(".option-input").forEach((input, index) => {
    input.value = question.options[index] || "";
  });
  document.getElementById("adminFormTitle").textContent = "Edit Question";
}

function deleteQuestion(id) {
  if (!confirm("Delete this question?")) return;
  saveQuestionBank(getQuestionBank().filter((item) => item.id !== id));
  renderAdminQuestions();
  renderInstructionStats();
}

function uploadQuestions(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported)) throw new Error("JSON must be an array.");
      saveQuestionBank(imported.map((item, index) => ({ id: item.id || `UP-${Date.now()}-${index}`, type: "mcq", ...item })));
      renderAdminQuestions();
      renderInstructionStats();
      showToast("Question set uploaded.", "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  };
  reader.readAsText(file);
}

document.getElementById("loginForm").addEventListener("submit", login);
document.getElementById("startExamButton").addEventListener("click", startExam);
document.getElementById("prevButton").addEventListener("click", () => moveQuestion(-1));
document.getElementById("nextButton").addEventListener("click", () => moveQuestion(1));
document.getElementById("clearButton").addEventListener("click", clearAnswer);
document.getElementById("submitButton").addEventListener("click", () => submitExam(false));
document.getElementById("downloadPdfButton").addEventListener("click", downloadPdf);
document.getElementById("downloadWrongButton").addEventListener("click", () => downloadText("mts-wrong-questions.txt", resultLines((item) => !item.isCorrect)));
document.getElementById("downloadCorrectButton").addEventListener("click", () => downloadText("mts-correct-questions.txt", resultLines((item) => item.isCorrect)));
document.getElementById("adminLoginForm").addEventListener("submit", adminLogin);
document.getElementById("questionForm").addEventListener("submit", saveAdminQuestion);
document.getElementById("resetQuestionButton").addEventListener("click", resetAdminForm);
document.getElementById("questionUpload").addEventListener("change", uploadQuestions);

renderInstructionStats();
installSecurityControls();
openAdminIfNeeded();
