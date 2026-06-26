export function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

export function prepareQuestions(questions) {
  return shuffle(questions).map((question) => ({
    ...question,
    options: question.options ? shuffle(question.options) : []
  }));
}

export function evaluate(questions, answers) {
  const review = questions.map((question) => {
    const selectedAnswer = answers[question.id] || "";
    const isSkipped = !selectedAnswer;
    const isCorrect = !isSkipped && normalize(selectedAnswer) === normalize(question.correctAnswer);
    return { ...question, selectedAnswer, isSkipped, isCorrect };
  });

  const correct = review.filter((item) => item.isCorrect).length;
  const skipped = review.filter((item) => item.isSkipped).length;
  const wrong = review.length - correct - skipped;
  const percentage = review.length ? Math.round((correct / review.length) * 100) : 0;

  return {
    total: review.length,
    obtained: correct,
    correct,
    wrong,
    skipped,
    percentage,
    status: percentage >= 50 ? "Pass" : "Fail",
    review
  };
}

function normalize(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${String(secs).padStart(2, "0")}s`;
}

export function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadPdfReport(filename, lines) {
  const pdf = buildSimplePdf(lines);
  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildSimplePdf(lines) {
  const safeLines = lines.map((line) => String(line).replace(/[()\\]/g, "\\$&").slice(0, 100));
  const textCommands = safeLines.slice(0, 58).map((line, index) => {
    const y = 790 - index * 13;
    return `BT /F1 9 Tf 42 ${y} Td (${line}) Tj ET`;
  }).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${textCommands.length} >>\nstream\n${textCommands}\nendstream`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return pdf;
}
