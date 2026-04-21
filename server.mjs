import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);

const teachers = JSON.parse(await readFile(path.join(__dirname, "data", "teachers.json"), "utf8"));

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function buildSystemPrompt(teacher, skill) {
  return [
    "你是高考志愿 AI 讲师网站中的一个讲师角色。",
    "你必须严格遵循下方讲师 skill。涉及具体院校录取线、招生计划、政策、就业数据时，如果当前上下文没有可靠数据，必须提醒用户需要核对最新官方信息。",
    "不要编造具体分数线、招生计划、就业率或薪资数据。",
    "优先追问缺失的关键信息，再给阶段性建议。",
    "",
    `当前讲师：${teacher.name}`,
    `专业方向：${teacher.direction}`,
    "",
    skill
  ].join("\n");
}

function mockChat({ teacher, message, profile, history }) {
  const missing = [
    ["省份", profile.province],
    ["分数", profile.score],
    ["位次", profile.rank],
    ["选科", profile.subjects],
    ["目标城市", profile.targetCity]
  ]
    .filter(([, value]) => !String(value || "").trim())
    .map(([label]) => label);

  if (missing.length > 0) {
    return [
      `${teacher.name}收到。你问的是：“${message}”。`,
      "",
      `现在最缺的是：${missing.join("、")}。这些信息不补齐，我只能给方向，不能给具体志愿判断。`,
      "",
      "先给你一个阶段性建议：",
      `- 这个问题要从“${teacher.direction}”切入，不要只看学校名字或热门专业。`,
      "- 后续做正式方案时，要核对近三年位次、当年招生计划、选科限制和专业组变化。",
      "- 如果是普通家庭，优先把就业面、城市机会和转专业成本看清楚。",
      "",
      "你可以先补一句：我是哪个省、多少分、多少位次、什么选科、想去哪些城市。"
    ].join("\n");
  }

  return [
    `${teacher.name}基于你当前信息先给判断。${history.length > 1 ? "结合前面的对话，" : ""}你的问题是：“${message}”。`,
    "",
    "1. 先给结论",
    "下一步应该先做“院校层级 + 专业方向 + 城市机会”的三角匹配，而不是直接问哪个学校最好。",
    "",
    "2. 关键风险",
    "- 只看分数不看位次，容易误判。",
    "- 只看热门专业不看普通毕业生去向，容易高估结果。",
    "- 只看学校名气不看城市和专业组，后期就业可能吃亏。",
    "",
    "3. 建议动作",
    "- 先列 3 个最想去的城市。",
    "- 再列 3 个不能接受的专业方向。",
    "- 最后按冲、稳、保各准备一批候选，逐个核对近三年录取位次。",
    "",
    `如果你继续问，我会按“${teacher.skills.join("、")}”继续拆。`
  ].join("\n");
}

async function openAiCompatibleChat({ endpoint, apiKey, model, systemPrompt, messages, extraHeaders = {} }) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.5,
      max_tokens: 1200
    })
  });

  if (!response.ok) {
    throw new Error(`模型请求失败：${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "模型没有返回内容。";
}

async function geminiChat(systemPrompt, messages) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const transcript = messages
    .map((item) => `${item.role === "user" ? "用户" : "讲师"}：${item.content}`)
    .join("\n\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: transcript }] }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 1200 }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini request failed: ${response.status}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "模型没有返回内容。";
}

async function generateReply({ teacher, systemPrompt, messages, profile }) {
  const provider = String(process.env.AI_PROVIDER || "mock").toLowerCase();
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");

  if (provider === "deepseek") {
    if (!process.env.DEEPSEEK_API_KEY) throw new Error("Missing DEEPSEEK_API_KEY");
    return openAiCompatibleChat({
      endpoint: "https://api.deepseek.com/chat/completions",
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      systemPrompt,
      messages
    });
  }

  if (provider === "openrouter") {
    if (!process.env.OPENROUTER_API_KEY) throw new Error("Missing OPENROUTER_API_KEY");
    return openAiCompatibleChat({
      endpoint: "https://openrouter.ai/api/v1/chat/completions",
      apiKey: process.env.OPENROUTER_API_KEY,
      model: process.env.OPENROUTER_MODEL || "openrouter/auto",
      systemPrompt,
      messages,
      extraHeaders: {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Gaokao Volunteer AI"
      }
    });
  }

  if (provider === "gemini") {
    return geminiChat(systemPrompt, messages);
  }

  return mockChat({
    teacher,
    message: latestUserMessage?.content || "",
    profile,
    history: messages
  });
}

async function handleChat(request, response) {
  const body = await readBody(request);
  const teacher = teachers.find((item) => item.id === body.teacherId);

  if (!teacher) {
    sendJson(response, 404, { error: "讲师不存在" });
    return;
  }

  const skill = await readFile(path.join(__dirname, "teacher-skills", teacher.skillFile), "utf8");
  const systemPrompt = buildSystemPrompt(teacher, skill);
  const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  const reply = await generateReply({
    teacher,
    systemPrompt,
    messages,
    profile: body.profile || {}
  });

  sendJson(response, 200, { reply, provider: process.env.AI_PROVIDER || "mock" });
}

async function serveStatic(url, response) {
  const staticRoot = existsSync(path.join(__dirname, "dist"))
    ? path.join(__dirname, "dist")
    : path.join(__dirname, "public");
  const safePath = url === "/" ? "/index.html" : decodeURIComponent(url);
  const filePath = path.join(staticRoot, safePath);

  if (!filePath.startsWith(staticRoot) || !existsSync(filePath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const ext = path.extname(filePath);
  const content = await readFile(filePath);
  response.writeHead(200, { "Content-Type": contentTypes[ext] || "application/octet-stream" });
  response.end(content);
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);

    if (request.method === "GET" && url.pathname === "/api/teachers") {
      sendJson(response, 200, teachers);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/chat") {
      await handleChat(request, response);
      return;
    }

    if (request.method === "GET") {
      await serveStatic(url.pathname, response);
      return;
    }

    sendJson(response, 405, { error: "Method not allowed" });
  } catch (error) {
    sendJson(response, 500, { error: error instanceof Error ? error.message : "未知错误" });
  }
});

server.listen(port, () => {
  console.log(`GaokaoVolunteerAI running at http://localhost:${port}`);
});
