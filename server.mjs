import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);

loadLocalEnv();

const teachers = JSON.parse(await readFile(path.join(__dirname, "data", "teachers.json"), "utf8"));

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function loadLocalEnv() {
  for (const fileName of [".env.local", ".env"]) {
    const envPath = path.join(__dirname, fileName);

    if (!existsSync(envPath)) {
      continue;
    }

    const lines = readFileSync(envPath, "utf8").split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const equalsIndex = trimmed.indexOf("=");

      if (equalsIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, equalsIndex).trim();
      const rawValue = trimmed.slice(equalsIndex + 1).trim();
      const value = rawValue.replace(/^["']|["']$/g, "");

      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function summarizeReply(reply) {
  const lines = String(reply || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^本次总结[：:]/.test(line));
  const firstUsefulLine = lines.find((line) => !/^\d+[.、]/.test(line)) || lines[0] || "本次建议已经整理完。";
  const cleanLine = firstUsefulLine
    .replace(/^[-•]\s*/, "")
    .replace(/^(先给结论|结论|总判断|建议动作)[：:：]?\s*/, "")
    .replace(/[。！？!?；;，,]\s*$/, "");

  return cleanLine.length > 70 ? `${cleanLine.slice(0, 70)}...` : cleanLine;
}

function formatReplyNumbering(reply) {
  const chineseNumbers = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  const headingPattern = /^(先给结论|结论|关键追问|风险点|关键风险|建议动作|当前适合|资料完整度|总判断|底层原因|分领域展开|时间节奏|操作建议|一句话点醒)/;
  let topLevelIndex = 0;
  let subLevelIndex = 0;

  return String(reply || "")
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();

      if (!trimmed) {
        return line;
      }

      const numberedHeading = trimmed.match(/^\d+[.、]\s*(.+)$/);
      const headingText = numberedHeading?.[1] || trimmed;

      if (headingPattern.test(headingText)) {
        const number = chineseNumbers[topLevelIndex] || String(topLevelIndex + 1);
        topLevelIndex += 1;
        subLevelIndex = 0;
        return `${number}、${headingText}`;
      }

      const bulletText = trimmed.match(/^[-•]\s*(.+)$/)?.[1];

      if (bulletText) {
        subLevelIndex += 1;
        return `${subLevelIndex}. ${bulletText}`;
      }

      const bracketNumbered = trimmed.match(/^[（(](\d+)[）)]\s*(.+)$/);

      if (bracketNumbered) {
        return `${bracketNumbered[1]}. ${bracketNumbered[2]}`;
      }

      const letterNumbered = trimmed.match(/^(?:[（(]?([a-zA-Z])[）).、])\s*(.+)$/);

      if (letterNumbered) {
        return `${letterNumbered[1].toLowerCase()}. ${letterNumbered[2]}`;
      }

      if (numberedHeading) {
        return `${numberedHeading[0].match(/^\d+/)?.[0] || "1"}. ${headingText}`;
      }

      return line;
    })
    .join("\n");
}

function sanitizeReply(reply) {
  const withoutStars = String(reply || "").replace(/\*/g, "");
  const cleaned = withoutStars
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const formatted = formatReplyNumbering(cleaned);

  if (/本次总结[：:]/.test(formatted)) {
    return formatted;
  }

  return `${formatted}\n\n本次总结：${summarizeReply(formatted)}。`;
}

function extractJsonObject(text) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  const candidate = fenced?.[1] || (start >= 0 && end > start ? raw.slice(start, end + 1) : "");

  if (!candidate || !candidate.trim().startsWith("{")) {
    return null;
  }

  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function stripLeadingNumbering(text) {
  return String(text || "")
    .trim()
    .replace(/^([一二三四五六七八九十]+)[、.．]\s*/, "")
    .replace(/^\d+[、.．]\s*/, "")
    .replace(/^[a-zA-Z][、.．]\s*/, "")
    .trim();
}

function normalizeStructuredItem(item, depth = 0) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const text = stripLeadingNumbering(item.text);

  if (!text) {
    return null;
  }

  const children =
    Array.isArray(item.children) && depth < 1
      ? item.children.map((child) => normalizeStructuredItem(child, depth + 1)).filter(Boolean)
      : [];

  return children.length > 0 ? { text, children } : { text };
}

function normalizeStructuredReply(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.sections)) {
    return null;
  }

  const sections = value.sections
    .map((section) => {
      if (!section || typeof section !== "object") {
        return null;
      }

      const title = stripLeadingNumbering(section.title);
      const items = Array.isArray(section.items)
        ? section.items.map((item) => normalizeStructuredItem(item)).filter(Boolean)
        : [];

      if (!title) {
        return null;
      }

      return { title, items };
    })
    .filter(Boolean);

  if (sections.length === 0) {
    return null;
  }

  const summary = stripLeadingNumbering(value.summary);
  return summary ? { sections, summary } : { sections };
}

function structuredReplyToText(reply) {
  if (!reply) {
    return "";
  }

  const lines = [];
  const chineseNumbers = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

  function pushItems(items, depth = 0) {
    items.forEach((item, index) => {
      const marker = depth === 0 ? `${index + 1}.` : `${String.fromCharCode(97 + index)}.`;
      lines.push(`${"  ".repeat(depth)}${marker} ${item.text}`);
      if (Array.isArray(item.children)) {
        pushItems(item.children, depth + 1);
      }
    });
  }

  reply.sections.forEach((section, index) => {
    lines.push(`${chineseNumbers[index] || index + 1}、${section.title}`);
    pushItems(section.items || []);
    lines.push("");
  });

  if (reply.summary) {
    lines.push(`本次总结：${reply.summary}`);
  }

  return lines.join("\n").trim();
}

function parseStructuredReply(reply) {
  return normalizeStructuredReply(extractJsonObject(reply));
}

async function readBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function getProfileLabels(teacherId) {
  if (teacherId === "tarot") {
    return ["咨询主题", "牌阵偏好", "时间阶段", "相关对象", "具体背景", "希望风格"];
  }

  if (teacherId === "fortuneMaster") {
    return ["咨询体系", "出生信息", "出生地点", "咨询主题", "现实背景", "输出偏好"];
  }

  return ["省份", "分数", "位次", "选科", "家庭情况", "目标城市"];
}

function formatProfile(teacherId, profile = {}) {
  const labels = getProfileLabels(teacherId);
  const rows = [
    [labels[0], profile.province],
    [labels[1], profile.score],
    [labels[2], profile.rank],
    [labels[3], profile.subjects],
    [labels[4], profile.family],
    [labels[5], profile.targetCity]
  ].filter(([, value]) => String(value || "").trim());

  if (rows.length === 0) {
    return "用户暂未填写补充资料。";
  }

  return rows.map(([label, value]) => `${label}：${value}`).join("\n");
}

function buildSystemPrompt(teacher, skill, profile) {
  return [
    "你是 AI 讲师网站中的一个讲师角色。",
    "你必须严格遵循下方讲师 skill。",
    "涉及具体院校录取线、招生计划、政策、就业数据时，如果当前上下文没有可靠数据，必须提醒用户核对最新官方信息。",
    "不要编造具体分数线、招生计划、就业率或薪资数据。",
    "涉及命理、塔罗、玄学咨询时，不要给绝对化、恐吓式或替代医疗/法律/投资判断的结论。",
    "优先追问缺失的关键信息；如果信息不足，只能给阶段性、象征性或低精度建议。",
    "回答要相对简洁易懂，优先使用短句和少量编号，不要使用星号、Markdown 加粗或复杂表格。",
    "回答里的一级大点必须用中文数字加顿号，例如：一、先给结论；二、关键风险。",
    "一级大点下面的小点必须用阿拉伯数字加点号，例如：1. 先核对位次；2. 再看专业组。不要写（1）或 1、。",
    "如果小点下面还需要细分，第三级必须用小写字母加点号，例如：a. 就业优先；b. 读研优先。尽量不要超过三级。",
    "每次回答最后必须追加一行：本次总结：用一句话概括本次建议。",
    "请优先只输出合法 JSON，不要输出 Markdown，不要包裹代码块。JSON 格式必须是：{\"sections\":[{\"title\":\"一级标题\",\"items\":[{\"text\":\"要点\",\"children\":[{\"text\":\"子要点\"}]}]}],\"summary\":\"一句话总结\"}。",
    "sections 是一级段落；items 是二级要点；children 是三级要点。不要把编号写进 title 或 text，编号由前端渲染。",
    "最多只允许三层结构：sections、items、children。不要再创建 children 的 children。每个 title、text 都不要带编号。",
    "",
    `当前讲师：${teacher.name}`,
    `专业方向：${teacher.direction}`,
    "",
    "用户补充资料：",
    formatProfile(teacher.id, profile),
    "",
    skill
  ].join("\n");
}

function mockChat({ teacher, message, profile, history }) {
  if (teacher.id === "tarot") {
    return [
      `${teacher.name}收到。你问的是：“${message}”。`,
      "",
      "当前是 Mock 模式，我不会假装已经完成真实抽牌。你可以把它当作塔罗讲师的流程预览：",
      "1. 先确认主题：感情、事业、选择题、每日指引或阶段规划。",
      "2. 再确认牌阵：单张牌适合快速指引，三牌阵适合看关系或时间线，五牌阵适合拆阻力和建议。",
      "3. 正式接入模型后，讲师会按牌位、正逆位、牌间关系和本周行动建议来输出。",
      "",
      "如果你要继续，可以补一句：我想问什么主题、想用几张牌、最近一周发生了什么具体事。"
    ].join("\n");
  }

  if (teacher.id === "fortuneMaster") {
    return [
      `${teacher.name}收到。你问的是：“${message}”。`,
      "",
      "当前是 Mock 模式，我先按命理专家的工作流给你分流：",
      "1. 长期事业、性格底色、人生阶段：优先八字、紫微、西方星盘或数字命理。",
      "2. 短期选择、对方态度、事情能否推进：优先塔罗、六爻、梅花或奇门。",
      "3. 空间布置、择时窗口：优先风水、择时或奇门节奏。",
      "",
      "要做正式解读，请补充：想用哪个体系、出生年月日时和出生地，或把你的具体问题和发生时间说清楚。"
    ].join("\n");
  }

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
      `1. 这个问题要从“${teacher.direction}”切入，不要只看学校名字或热门专业。`,
      "2. 后续做正式方案时，要核对近三年位次、当年招生计划、选科限制和专业组变化。",
      "3. 如果是普通家庭，优先把就业面、城市机会和转专业成本看清楚。",
      "",
      "你可以先补一句：我是哪个省、多少分、多少位次、什么选科、想去哪些城市。"
    ].join("\n");
  }

  return [
    `${teacher.name}基于你当前信息先给判断。${history.length > 1 ? "结合前面的对话，" : ""}你的问题是：“${message}”。`,
    "",
    "一、先给结论",
    "下一步应该先做“院校层级 + 专业方向 + 城市机会”的三角匹配，而不是直接问哪个学校最好。",
    "",
    "二、关键风险",
    "1. 只看分数不看位次，容易误判。",
    "2. 只看热门专业不看普通毕业生去向，容易高估结果。",
    "3. 只看学校名气不看城市和专业组，后期就业可能吃亏。",
    "",
    "三、建议动作",
    "1. 先列 3 个最想去的城市。",
    "2. 再列 3 个不能接受的专业方向。",
    "3. 最后按冲、稳、保各准备一批候选，逐个核对近三年录取位次。",
    "",
    `如果你继续问，我会按“${teacher.skills.join("、")}”继续拆。`
  ].join("\n");
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || "").replace(/\/+$/, "");
}

function buildChatEndpoint(baseUrl) {
  const normalized = normalizeBaseUrl(baseUrl);

  if (normalized.endsWith("/chat/completions")) {
    return normalized;
  }

  if (normalized.endsWith("/v1")) {
    return `${normalized}/chat/completions`;
  }

  return `${normalized}/v1/chat/completions`;
}

async function openAiCompatibleChat({ baseUrl, apiKey, model, systemPrompt, messages, extraHeaders = {} }) {
  const endpoint = buildChatEndpoint(baseUrl);
  const headers = {
    "Content-Type": "application/json",
    ...extraHeaders
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.5,
      max_tokens: 1200
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`模型请求失败：${response.status}${detail ? ` ${detail.slice(0, 200)}` : ""}`);
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

  if (provider === "openai" || provider === "gpt" || provider === "custom-openai") {
    return openAiCompatibleChat({
      baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      systemPrompt,
      messages
    });
  }

  if (provider === "deepseek") {
    if (!process.env.DEEPSEEK_API_KEY) throw new Error("Missing DEEPSEEK_API_KEY");
    return openAiCompatibleChat({
      baseUrl: "https://api.deepseek.com",
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      systemPrompt,
      messages
    });
  }

  if (provider === "openrouter") {
    if (!process.env.OPENROUTER_API_KEY) throw new Error("Missing OPENROUTER_API_KEY");
    return openAiCompatibleChat({
      baseUrl: "https://openrouter.ai/api/v1",
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
  const systemPrompt = buildSystemPrompt(teacher, skill, body.profile || {});
  const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  const reply = await generateReply({
    teacher,
    systemPrompt,
    messages,
    profile: body.profile || {}
  });

  const structuredReply = parseStructuredReply(reply);
  const displayReply = structuredReply ? structuredReplyToText(structuredReply) : sanitizeReply(reply);

  sendJson(response, 200, {
    reply: displayReply,
    structuredReply,
    provider: process.env.AI_PROVIDER || "mock"
  });
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
