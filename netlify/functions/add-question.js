const { airtableFetch, mapQuestion, parseBody, requireAdmin, requireMethod, response, tableUrl, validateQuestion } = require("./utils/airtable");

exports.handler = async (event) => {
  const methodError = requireMethod(event, "POST");
  if (methodError) return methodError;
  const adminError = requireAdmin(event);
  if (adminError) return adminError;

  try {
    const fields = validateQuestion(parseBody(event));
    const payload = await airtableFetch(tableUrl(), {
      method: "POST",
      body: JSON.stringify({ fields })
    });
    return response(200, { question: mapQuestion(payload) });
  } catch (error) {
    return response(400, { error: error.message });
  }
};
