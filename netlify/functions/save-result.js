const { airtableFetch, parseBody, requireMethod, response, tableUrl } = require("./utils/airtable");

exports.handler = async (event) => {
  const methodError = requireMethod(event, "POST");
  if (methodError) return methodError;

  try {
    const result = parseBody(event);
    if (!result.studentName || !result.rollNumber) {
      throw new Error("Student name and roll number are required.");
    }

    const resultsTable = process.env.AIRTABLE_RESULTS_TABLE_NAME || "Results";
    const fields = {
      StudentName: result.studentName,
      RollNumber: result.rollNumber,
      ExamName: result.examName || "MTS Science MCQ Test",
      TotalMarks: result.total,
      ObtainedMarks: result.obtained,
      CorrectAnswers: result.correct,
      WrongAnswers: result.wrong,
      Percentage: result.percentage,
      PassFail: result.status,
      TimeTaken: result.timeTaken,
      SubmittedAt: result.submittedAt || new Date().toISOString(),
      AnswersJson: JSON.stringify(result.review || [])
    };

    const payload = await airtableFetch(tableUrl(resultsTable), {
      method: "POST",
      body: JSON.stringify({ fields })
    });

    return response(200, { saved: true, id: payload.id });
  } catch (error) {
    return response(400, { error: error.message });
  }
};
