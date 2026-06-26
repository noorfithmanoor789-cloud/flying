const fs = require("fs");
const path = require("path");

const token = process.env.AIRTABLE_TOKEN;
const baseId = process.env.AIRTABLE_BASE_ID;
const tableName = process.env.AIRTABLE_TABLE_NAME || "Questions";

if (!token || !baseId) {
  console.error("AIRTABLE_TOKEN and AIRTABLE_BASE_ID are required.");
  process.exit(1);
}

const questionsPath = path.join(__dirname, "..", "data", "science-questions.json");
const questions = JSON.parse(fs.readFileSync(questionsPath, "utf8"));
const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;

function toFields(question) {
  return {
    Question: question.question,
    Option1: question.options?.[0] || "",
    Option2: question.options?.[1] || "",
    Option3: question.options?.[2] || "",
    Option4: question.options?.[3] || "",
    CorrectAnswer: question.correctAnswer,
    Explanation: question.explanation,
    Subject: question.subject || "Science",
    Type: question.type || "mcq",
    CreatedAt: new Date().toISOString()
  };
}

async function seed() {
  for (const question of questions) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fields: toFields(question) })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }
  }
  console.log(`Seeded ${questions.length} Science questions into Airtable.`);
}

seed().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
