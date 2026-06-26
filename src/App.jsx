import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Lock,
  LogOut,
  Plus,
  Save,
  ShieldCheck,
  Trash2
} from "lucide-react";
import { scienceQuestions } from "./data/scienceQuestions.js";
import { addQuestion, deleteQuestion, getQuestions, saveResult, updateQuestion } from "./services/api.js";
import { downloadPdfReport, downloadTextFile, evaluate, formatTime, prepareQuestions } from "./utils/exam.js";

const EXAM_SECONDS = 20 * 60;
const WARNING_SECONDS = 5 * 60;
const DRAFT_KEY = "mts_react_exam_draft";
const ADMIN_SESSION_KEY = "mts_admin_session";

const emptyQuestion = {
  question: "",
  options: ["", "", "", ""],
  correctAnswer: "",
  explanation: "",
  subject: "Science",
  type: "mcq"
};

export default function App() {
  const [toast, setToast] = useState(null);
  const [mode, setMode] = useState(new URLSearchParams(window.location.search).get("admin") === "1" ? "admin" : "login");
  const [student, setStudent] = useState({ fullName: "", rollNumber: "" });
  const [questionBank, setQuestionBank] = useState(scienceQuestions);
  const [examQuestions, setExamQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [startedAt, setStartedAt] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [remaining, setRemaining] = useState(EXAM_SECONDS);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [securityWarnings, setSecurityWarnings] = useState(0);

  const activeQuestion = examQuestions[currentIndex];
  const progress = examQuestions.length ? ((currentIndex + 1) / examQuestions.length) * 100 : 0;

  useEffect(() => {
    loadQuestions();
  }, []);

  useEffect(() => {
    if (mode !== "exam" || !endTime || result) return undefined;
    const timer = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setRemaining(next);
      if (next === 0) {
        window.clearInterval(timer);
        submitExam(true);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [mode, endTime, result]);

  useEffect(() => {
    if (mode !== "exam") return undefined;
    const block = (event) => {
      event.preventDefault();
      showToast("Exam security restriction is active.", "warning");
    };
    const visibility = () => {
      if (document.hidden) registerWarning("Tab switching detected.");
    };
    const beforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "Exam is running.";
    };
    ["copy", "cut", "paste", "contextmenu"].forEach((eventName) => document.addEventListener(eventName, block));
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      ["copy", "cut", "paste", "contextmenu"].forEach((eventName) => document.removeEventListener(eventName, block));
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== "exam") return;
    const draft = {
      student,
      examQuestions,
      answers,
      currentIndex,
      startedAt,
      endTime,
      securityWarnings
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [student, examQuestions, answers, currentIndex, startedAt, endTime, securityWarnings, mode]);

  async function loadQuestions() {
    try {
      const payload = await getQuestions();
      const items = payload.questions?.length ? payload.questions : scienceQuestions;
      setQuestionBank(items);
    } catch (error) {
      setQuestionBank(scienceQuestions);
      showToast("Airtable unavailable. Local Science questions loaded.", "warning");
    }
  }

  function showToast(message, type = "info") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3600);
  }

  function registerWarning(message) {
    setSecurityWarnings((count) => {
      const next = count + 1;
      showToast(`${message} Warning ${next}/3`, "warning");
      if (next >= 3) window.setTimeout(() => submitExam(true), 200);
      return next;
    });
  }

  function login(event) {
    event.preventDefault();
    if (!student.fullName.trim() || !student.rollNumber.trim()) {
      showToast("Student full name and roll number are required.", "error");
      return;
    }
    setMode("instructions");
  }

  async function startExam() {
    const prepared = prepareQuestions(questionBank);
    setExamQuestions(prepared);
    setAnswers({});
    setCurrentIndex(0);
    setStartedAt(new Date().toISOString());
    setEndTime(Date.now() + EXAM_SECONDS * 1000);
    setRemaining(EXAM_SECONDS);
    setSecurityWarnings(0);
    setMode("exam");
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      showToast("Fullscreen was blocked by this browser.", "warning");
    }
  }

  async function submitExam(auto = false) {
    if (submitting || !examQuestions.length) return;
    if (!auto && !window.confirm("Submit exam now?")) return;
    setSubmitting(true);
    const summary = evaluate(examQuestions, answers);
    const submittedAt = new Date().toISOString();
    const timeTakenSeconds = Math.max(0, Math.round((new Date(submittedAt) - new Date(startedAt)) / 1000));
    const finalResult = {
      ...summary,
      studentName: student.fullName,
      rollNumber: student.rollNumber,
      examName: "MTS Science MCQ Test",
      submittedAt,
      timeTaken: formatTime(timeTakenSeconds),
      securityWarnings,
      autoSubmitted: auto
    };
    setResult(finalResult);
    setMode("result");
    localStorage.removeItem(DRAFT_KEY);
    try {
      await saveResult(finalResult);
      showToast("Result saved successfully.", "success");
    } catch (error) {
      showToast(`Result saved locally only: ${error.message}`, "warning");
      localStorage.setItem(`mts_pending_result_${Date.now()}`, JSON.stringify(finalResult));
    } finally {
      setSubmitting(false);
    }
  }

  function selectAnswer(value) {
    setAnswers((current) => ({ ...current, [activeQuestion.id]: value }));
  }

  const screen = useMemo(() => {
    if (mode === "admin") return <AdminDashboard showToast={showToast} />;
    if (mode === "instructions") {
      return <InstructionsPage total={questionBank.length} student={student} onStart={startExam} />;
    }
    if (mode === "exam") {
      return (
        <ExamPage
          question={activeQuestion}
          index={currentIndex}
          total={examQuestions.length}
          answer={activeQuestion ? answers[activeQuestion.id] : ""}
          remaining={remaining}
          progress={progress}
          securityWarnings={securityWarnings}
          warning={remaining <= WARNING_SECONDS}
          submitting={submitting}
          onAnswer={selectAnswer}
          onNext={() => setCurrentIndex((value) => Math.min(value + 1, examQuestions.length - 1))}
          onPrev={() => setCurrentIndex((value) => Math.max(value - 1, 0))}
          onSubmit={() => submitExam(false)}
        />
      );
    }
    if (mode === "result" && result) return <ResultPage result={result} />;
    return <LoginPage student={student} setStudent={setStudent} onSubmit={login} />;
  }, [mode, questionBank, student, activeQuestion, currentIndex, examQuestions, answers, remaining, progress, securityWarnings, submitting, result]);

  return (
    <div className="min-h-screen bg-mts-soft text-mts-ink">
      <Header isAdmin={mode === "admin"} onExitAdmin={() => setMode("login")} />
      <main className="mx-auto max-w-6xl px-4 pb-12 pt-28 sm:px-6">{screen}</main>
      {toast && <Toast {...toast} />}
    </div>
  );
}

function Header({ isAdmin, onExitAdmin }) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-slate-200 bg-white/95 shadow-mts backdrop-blur">
      <div className="mx-auto flex min-h-20 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <img src="/assets/images/logo.png" alt="MTS Logo" className="h-12 w-12 object-contain" />
          <div>
            <p className="text-xs font-bold uppercase tracking-normal text-mts-primary">Moro Testing Service</p>
            <h1 className="text-lg font-black text-mts-ink sm:text-2xl">MTS Online Exam System</h1>
          </div>
        </div>
        {isAdmin && (
          <button className="btn-outline" onClick={onExitAdmin} type="button">
            <LogOut size={17} /> Exit Admin
          </button>
        )}
      </div>
    </header>
  );
}

function LoginPage({ student, setStudent, onSubmit }) {
  return (
    <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="hero-panel">
        <p className="eyebrow">Secure Testing Portal</p>
        <h2 className="mt-3 text-4xl font-black leading-tight text-white sm:text-5xl">MTS Science Assessment</h2>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-white/80">
          A professional one-question-at-a-time exam experience designed for mobile, tablet, and desktop candidates.
        </p>
      </div>
      <form className="card space-y-5" onSubmit={onSubmit}>
        <div>
          <p className="eyebrow">Student Login</p>
          <h2 className="text-2xl font-black">Candidate Verification</h2>
        </div>
        <Field label="Student Full Name" value={student.fullName} onChange={(value) => setStudent({ ...student, fullName: value })} />
        <Field label="Roll Number" value={student.rollNumber} onChange={(value) => setStudent({ ...student, rollNumber: value })} />
        <button className="btn-primary w-full" type="submit">Continue</button>
      </form>
    </section>
  );
}

function Field({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-2 block font-bold">{label}</span>
      <input className="input" value={value} onChange={(event) => onChange(event.target.value)} required />
    </label>
  );
}

function InstructionsPage({ total, student, onStart }) {
  return (
    <section className="space-y-5">
      <div className="card flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="eyebrow">Instructions</p>
          <h2 className="text-3xl font-black">Read Before Starting</h2>
          <p className="mt-2 text-slate-600">{student.fullName} - Roll No: {student.rollNumber}</p>
        </div>
        <button className="btn-primary" onClick={onStart} type="button">
          <ShieldCheck size={19} /> Start Exam
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <InfoCard title="Total Questions" value={total} />
        <InfoCard title="Total Marks" value={total} />
        <InfoCard title="Duration" value="20 min" />
      </div>
      <div className="card">
        <h3 className="text-xl font-black">Exam Rules</h3>
        <ul className="mt-4 grid gap-3 text-slate-600">
          <li>Only one question appears at a time.</li>
          <li>Do not switch tabs, refresh, copy, paste, or leave fullscreen during the exam.</li>
          <li>The timer auto-submits when it reaches zero.</li>
          <li>Answers are saved during the attempt and sent to Airtable after submission.</li>
        </ul>
      </div>
    </section>
  );
}

function InfoCard({ title, value }) {
  return (
    <article className="card">
      <p className="font-bold text-slate-600">{title}</p>
      <strong className="mt-2 block text-3xl text-mts-primary">{value}</strong>
    </article>
  );
}

function ExamPage(props) {
  const isLast = props.index === props.total - 1;
  const isShort = props.question?.type === "short";
  const options = props.question?.type === "truefalse" ? ["True", "False"] : props.question?.options || [];
  return (
    <section className="space-y-5">
      <div className="card">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="eyebrow">Science Assessment</p>
            <h2 className="text-2xl font-black">Question {props.index + 1} of {props.total}</h2>
          </div>
          <div className="text-left sm:text-right">
            <div className={`timer ${props.warning ? "timer-danger" : ""}`}>{formatClock(props.remaining)}</div>
            <p className="mt-2 text-sm font-bold text-slate-500">Warnings: {props.securityWarnings}/3</p>
          </div>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-mts-primary to-mts-accent transition-all" style={{ width: `${props.progress}%` }} />
        </div>
      </div>
      <article className="card animate-soft">
        <p className="mb-3 inline-flex rounded-full bg-yellow-100 px-3 py-1 text-sm font-bold text-mts-primary">{props.question?.subject || "Science"}</p>
        <h3 className="text-2xl font-black leading-snug">{props.question?.question}</h3>
        {isShort ? (
          <textarea
            className="input mt-6 min-h-36 py-3"
            placeholder="Type your answer"
            value={props.answer}
            onChange={(event) => props.onAnswer(event.target.value)}
          />
        ) : (
          <div className="mt-6 grid gap-3">
            {options.map((option) => (
              <label key={option} className={`option ${props.answer === option ? "option-active" : ""}`}>
                <input className="h-4 w-4 accent-mts-primary" type="radio" name="answer" checked={props.answer === option} onChange={() => props.onAnswer(option)} />
                <span>{option}</span>
              </label>
            ))}
          </div>
        )}
      </article>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <button className="btn-outline" disabled={props.index === 0} onClick={props.onPrev} type="button">Previous</button>
        {isLast ? (
          <button className="btn-danger" disabled={props.submitting} onClick={props.onSubmit} type="button">Submit Exam</button>
        ) : (
          <button className="btn-primary" onClick={props.onNext} type="button">Next Question</button>
        )}
      </div>
    </section>
  );
}

function ResultPage({ result }) {
  const correctText = result.review.filter((item) => item.isCorrect).map(reviewLine).join("\n\n");
  const wrongText = result.review.filter((item) => !item.isCorrect).map(reviewLine).join("\n\n");
  const pdfLines = [
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
    ...result.review.flatMap((item, index) => [
      `${index + 1}. ${item.question}`,
      `Your answer: ${item.selectedAnswer || "Not answered"}`,
      `Correct answer: ${item.correctAnswer}`,
      `Explanation: ${item.explanation}`,
      ""
    ])
  ];

  return (
    <section className="space-y-5">
      <div className="card flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="eyebrow">Result</p>
          <h2 className="text-3xl font-black">{result.studentName}</h2>
          <p className="mt-1 text-slate-600">Roll No: {result.rollNumber} - Time Taken: {result.timeTaken}</p>
        </div>
        <span className={`status ${result.status === "Pass" ? "status-pass" : "status-fail"}`}>{result.status}</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <InfoCard title="Total Marks" value={result.total} />
        <InfoCard title="Obtained" value={result.obtained} />
        <InfoCard title="Correct" value={result.correct} />
        <InfoCard title="Wrong" value={result.wrong} />
        <InfoCard title="Percentage" value={`${result.percentage}%`} />
      </div>
      <div className="card flex flex-col gap-3 sm:flex-row">
        <button className="btn-primary" onClick={() => downloadPdfReport("mts-full-result.pdf", pdfLines)} type="button"><Download size={18} /> Download Full Result PDF</button>
        <button className="btn-outline" onClick={() => downloadTextFile("mts-wrong-questions.txt", wrongText || "No wrong questions.")} type="button">Download Wrong Questions</button>
        <button className="btn-outline" onClick={() => downloadTextFile("mts-correct-questions.txt", correctText || "No correct questions.")} type="button">Download Correct Questions</button>
      </div>
      <div className="grid gap-4">
        {result.review.map((item, index) => (
          <article className={`review-card ${item.isCorrect ? "review-correct" : "review-wrong"}`} key={item.id}>
            <div className="flex items-center justify-between gap-3">
              <strong>Question {index + 1}</strong>
              <span>{item.isCorrect ? "Correct" : item.isSkipped ? "Skipped" : "Wrong"}</span>
            </div>
            <p className="mt-3 font-bold">{item.question}</p>
            <p className="mt-2 text-slate-600">Your answer: <strong>{item.selectedAnswer || "Not answered"}</strong></p>
            <p className="text-slate-600">Correct answer: <strong>{item.correctAnswer}</strong></p>
            <p className="mt-2 text-slate-600">{item.explanation}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function AdminDashboard({ showToast }) {
  const [password, setPassword] = useState(sessionStorage.getItem(ADMIN_SESSION_KEY) || "");
  const [authed, setAuthed] = useState(Boolean(sessionStorage.getItem(ADMIN_SESSION_KEY)));
  const [questions, setQuestions] = useState([]);
  const [form, setForm] = useState(emptyQuestion);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authed) refresh();
  }, [authed]);

  async function refresh() {
    setLoading(true);
    try {
      const payload = await getQuestions();
      setQuestions(payload.questions || []);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setLoading(false);
    }
  }

  function login(event) {
    event.preventDefault();
    if (!password.trim()) return;
    sessionStorage.setItem(ADMIN_SESSION_KEY, password);
    setAuthed(true);
  }

  async function saveQuestion(event) {
    event.preventDefault();
    const type = form.type || "mcq";
    const payload = {
      ...form,
      type,
      options: type === "truefalse" ? ["True", "False"] : type === "short" ? [] : form.options.filter(Boolean)
    };
    try {
      if (editingId) {
        await updateQuestion(editingId, payload, password);
        showToast("Question updated.", "success");
      } else {
        await addQuestion(payload, password);
        showToast("Question added.", "success");
      }
      setForm(emptyQuestion);
      setEditingId("");
      refresh();
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function removeQuestion(id) {
    if (!window.confirm("Delete this question?")) return;
    try {
      await deleteQuestion(id, password);
      showToast("Question deleted.", "success");
      refresh();
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function importJson(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const imported = JSON.parse(await file.text());
    for (const item of imported) {
      await addQuestion({ ...item, type: item.type || "mcq" }, password);
    }
    showToast("Question set uploaded to Airtable.", "success");
    refresh();
  }

  if (!authed) {
    return (
      <form className="card mx-auto max-w-md space-y-5" onSubmit={login}>
        <Lock className="text-mts-primary" />
        <h2 className="text-2xl font-black">Secure Admin Login</h2>
        <input className="input" type="password" placeholder="Admin password" value={password} onChange={(event) => setPassword(event.target.value)} />
        <button className="btn-primary w-full" type="submit">Open Dashboard</button>
      </form>
    );
  }

  return (
    <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <form className="card space-y-4" onSubmit={saveQuestion}>
        <h2 className="text-2xl font-black">{editingId ? "Edit Question" : "Add Question"}</h2>
        <select className="input" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
          <option value="mcq">MCQ</option>
          <option value="truefalse">True / False</option>
          <option value="short">Short question</option>
        </select>
        <textarea className="input min-h-28 py-3" placeholder="Question" value={form.question} onChange={(event) => setForm({ ...form, question: event.target.value })} required />
        {form.type === "mcq" && form.options.map((option, index) => (
          <input className="input" key={index} placeholder={`Option ${index + 1}`} value={option} onChange={(event) => {
            const next = [...form.options];
            next[index] = event.target.value;
            setForm({ ...form, options: next });
          }} />
        ))}
        {form.type === "truefalse" && <p className="rounded-lg bg-yellow-50 p-3 text-sm font-bold text-mts-primary">True / False options are generated automatically.</p>}
        <input className="input" placeholder="Correct answer" value={form.correctAnswer} onChange={(event) => setForm({ ...form, correctAnswer: event.target.value })} required />
        <input className="input" placeholder="Subject / category" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} />
        <textarea className="input min-h-24 py-3" placeholder="Explanation" value={form.explanation} onChange={(event) => setForm({ ...form, explanation: event.target.value })} />
        <div className="flex flex-col gap-3 sm:flex-row">
          <button className="btn-primary" type="submit"><Save size={18} /> Save Question</button>
          <label className="btn-outline cursor-pointer">
            <Plus size={18} /> Upload JSON
            <input className="hidden" type="file" accept="application/json" onChange={importJson} />
          </label>
        </div>
      </form>
      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-black">Question Bank</h2>
          <button className="btn-outline" onClick={refresh} type="button">{loading ? "Loading..." : "Refresh"}</button>
        </div>
        <div className="grid max-h-[680px] gap-3 overflow-auto pr-1">
          {questions.map((question) => (
            <article className="rounded-lg border border-slate-200 p-4" key={question.id}>
              <p className="font-black">{question.question}</p>
              <p className="mt-1 text-sm text-slate-600">{question.subject} · Answer: {question.correctAnswer}</p>
              <div className="mt-3 flex gap-2">
                <button className="btn-outline" onClick={() => {
                  setEditingId(question.id);
                  setForm({ ...emptyQuestion, ...question, options: [...(question.options || []), "", "", "", ""].slice(0, 4) });
                }} type="button">Edit</button>
                <button className="btn-danger" onClick={() => removeQuestion(question.id)} type="button"><Trash2 size={17} /> Delete</button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Toast({ message, type }) {
  return (
    <div className={`toast ${type}`}>
      {type === "success" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
      <span>{message}</span>
    </div>
  );
}

function formatClock(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function reviewLine(item, index = 0) {
  return [
    `Question ${index + 1}: ${item.question}`,
    `Your answer: ${item.selectedAnswer || "Not answered"}`,
    `Correct answer: ${item.correctAnswer}`,
    `Explanation: ${item.explanation}`
  ].join("\n");
}
