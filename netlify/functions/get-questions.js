const { airtableFetch, mapQuestion, requireMethod, response, tableUrl } = require("./utils/airtable");

exports.handler = async (event) => {
  const methodError = requireMethod(event, "GET");
  if (methodError) return methodError;

  try {
    const payload = await airtableFetch(`${tableUrl()}?pageSize=100`);
    return response(200, { questions: (payload.records || []).map(mapQuestion) });
  } catch (error) {
    return response(500, { error: error.message, questions: [] });
  }
};
