const jsonHeaders = { "Content-Type": "application/json" };

async function request(path, options = {}) {
  const response = await fetch(`/.netlify/functions/${path}`, {
    ...options,
    headers: {
      ...jsonHeaders,
      ...(options.headers || {})
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }
  return payload;
}

export function getQuestions() {
  return request("get-questions");
}

export function addQuestion(question, adminPassword) {
  return request("add-question", {
    method: "POST",
    headers: { "x-admin-password": adminPassword },
    body: JSON.stringify(question)
  });
}

export function updateQuestion(id, question, adminPassword) {
  return request("update-question", {
    method: "PUT",
    headers: { "x-admin-password": adminPassword },
    body: JSON.stringify({ id, ...question })
  });
}

export function deleteQuestion(id, adminPassword) {
  return request("delete-question", {
    method: "DELETE",
    headers: { "x-admin-password": adminPassword },
    body: JSON.stringify({ id })
  });
}

export function saveResult(result) {
  return request("save-result", {
    method: "POST",
    body: JSON.stringify(result)
  });
}
