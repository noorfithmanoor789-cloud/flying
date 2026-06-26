const { airtableFetch, mapQuestion, parseBody, requireAdmin, requireMethod, response, tableUrl, validateQuestion } = require("./utils/airtable");

exports.handler = async (event) => {
  const methodError = requireMethod(event, "PUT");
  if (methodError) return methodError;
  const adminError = requireAdmin(event);
  if (adminError) return adminError;

  try {
    const body = parseBody(event);
    if (!body.id) throw new Error("Question record id is required.");
    const fields = validateQuestion(body);
    const payload = await airtableFetch(`${tableUrl()}/${body.id}`, {
      method: "PATCH",
      body: JSON.stringify({ fields })
    });
    return response(200, { question: mapQuestion(payload) });
  } catch (error) {
    return response(400, { error: error.message });
  }
};
