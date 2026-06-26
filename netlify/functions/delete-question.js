const { airtableFetch, parseBody, requireAdmin, requireMethod, response, tableUrl } = require("./utils/airtable");

exports.handler = async (event) => {
  const methodError = requireMethod(event, "DELETE");
  if (methodError) return methodError;
  const adminError = requireAdmin(event);
  if (adminError) return adminError;

  try {
    const body = parseBody(event);
    if (!body.id) throw new Error("Question record id is required.");
    await airtableFetch(`${tableUrl()}/${body.id}`, { method: "DELETE" });
    return response(200, { deleted: true, id: body.id });
  } catch (error) {
    return response(400, { error: error.message });
  }
};
