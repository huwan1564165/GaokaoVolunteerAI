import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ChatMessage, StructuredReply, StructuredReplyItem, Teacher } from "./types";

const starterQuestionMap: Record<string, string[]> = {
  zhangxuefeng: [
    "我是河南物化生 580 分，普通家庭，想学计算机，怎么选？",
    "普通家庭学计算机还值得吗？",
    "怎么安排冲稳保比例？",
    "家长和孩子意见不一致怎么办？"
  ],
  tarot: ["帮我抽一张今天的指引牌", "感情方面最近怎么推进？", "我该不该换工作？", "帮我看一个三牌阵"],
  fortuneMaster: [
    "我想看八字事业方向，需要补充什么？",
    "帮我综合看一下最近运势",
    "我想问一件事是否适合推进",
    "帮我做关系合盘前期资料清单"
  ],
  familyFinance: [
    "我每月收入 2 万，怎么做预算和储蓄计划？",
    "应急金应该留多少比较合适？",
    "帮我梳理家庭资产负债和现金流",
    "税务材料和投资账户应该怎么整理？"
  ],
  beancountAdvisor: [
    "我想用 Beancount 记账，账户科目怎么设计？",
    "帮我写一笔工资和房租的 Beancount 示例",
    "Fava 里怎么查看每月消费结构？",
    "如何用记账数据分析储蓄率和净资产？"
  ],
  usStockResearch: [
    "帮我分析一只美股的基本面和风险",
    "最近市场主线和行业轮动怎么看？",
    "如何写一份美股投资备忘录？",
    "机构持仓变化应该怎么看？"
  ],
  tradingRisk: [
    "这笔交易怎么设置仓位和止损？",
    "帮我制定一份交易计划模板",
    "技术图形突破是否值得跟进？",
    "一个策略回测前要先确认哪些假设？"
  ]
};

const inputPlaceholderMap: Record<string, string> = {
  zhangxuefeng: "直接输入你的问题，例如：我是河南物化生 580 分，普通家庭，想学电子信息，怎么选？",
  tarot: "直接输入你的问题，例如：最近感情卡住了，想用三牌阵看看我、对方和关系状态。",
  fortuneMaster: "直接输入你的问题，例如：我想看事业方向，出生时间是 1999-08-12 早上 7 点左右，出生地杭州。",
  familyFinance: "直接输入你的财务问题，例如：我每月收入 2 万，房贷 6000，想知道预算和应急金怎么安排。",
  beancountAdvisor: "直接输入你的记账问题，例如：我想用 Beancount 管理银行卡、信用卡、基金和工资收入。",
  usStockResearch: "直接输入你的研究问题，例如：帮我从基本面、估值、行业和风险分析一下 MSFT。",
  tradingRisk: "直接输入你的交易问题，例如：账户 10 万，单笔最多亏 1%，这笔交易仓位应该怎么设？"
};

const teacherCategories = [
  {
    id: "planning",
    name: "升学与职业规划",
    description: "适合志愿填报、专业选择、城市取舍和就业导向判断。",
    teacherIds: ["zhangxuefeng"]
  },
  {
    id: "personal-insight",
    name: "自我探索与关系指引",
    description: "适合关系状态、阶段选择、个人节奏和行动建议。",
    teacherIds: ["tarot", "fortuneMaster"]
  },
  {
    id: "finance-investing",
    name: "投资与财务管理",
    description: "适合家庭财务、记账台账、美股研究、交易计划和风险控制。",
    teacherIds: ["familyFinance", "beancountAdvisor", "usStockResearch", "tradingRisk"]
  }
];
export default function App() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/teachers")
      .then((response) => response.json())
      .then((items: Teacher[]) => {
        setTeachers(items);
        setSelectedTeacherId(items[0]?.id || "");
      })
      .catch(() => setError("璁插笀鍒楄〃鍔犺浇澶辫触"));
  }, []);

  const selectedTeacher = useMemo(
    () => teachers.find((teacher) => teacher.id === selectedTeacherId) || teachers[0],
    [selectedTeacherId, teachers]
  );

  const starterQuestions = starterQuestionMap[selectedTeacher?.id || ""] || starterQuestionMap.zhangxuefeng;
  const inputPlaceholder = inputPlaceholderMap[selectedTeacher?.id || ""] || "直接输入你的问题。";

  function getCategoryTeachers(teacherIds: string[]) {
    return teacherIds
      .map((teacherId) => teachers.find((teacher) => teacher.id === teacherId))
      .filter((teacher): teacher is Teacher => Boolean(teacher));
  }

  function selectTeacher(id: string) {
    setSelectedTeacherId(id);
    setMessages([]);
    setInput("");
    setError("");
  }

  async function sendMessage(message: string) {
    const trimmed = message.trim();

    if (!trimmed || isLoading || !selectedTeacher) {
      return;
    }

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          teacherId: selectedTeacher.id,
          messages: nextMessages,
          profile: {}
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "璇锋眰澶辫触");
      }

      setMessages([...nextMessages, { role: "assistant", content: data.reply, structuredReply: data.structuredReply }]);
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : "璇锋眰澶辫触");
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  if (!selectedTeacher) {
    return (
      <main className="app-shell">
        <p>姝ｅ湪鍔犺浇璁插笀...</p>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">AI Teachers</p>
          <h1>AI 讲师工作台</h1>
        </div>
        <div className="current-teacher">
          <Avatar teacher={selectedTeacher} />
          <span>
            <strong>{selectedTeacher.shortName}</strong>
            <small>{selectedTeacher.title}</small>
          </span>
        </div>
      </header>

      <section className="workspace">
        <aside className="category-sidebar" aria-label="讲师分类">
          <div className="section-heading">
            <p className="eyebrow">Categories</p>
            <h2>讲师分类</h2>
          </div>

          <div className="category-list">
            {teacherCategories.map((category) => {
              const categoryTeachers = getCategoryTeachers(category.teacherIds);
              const isActive = categoryTeachers.some((teacher) => teacher.id === selectedTeacher.id);

              return (
                <div className={`category-item ${isActive ? "active" : ""}`} key={category.id}>
                  <button className="category-trigger" type="button">
                    <span>
                      <strong>{category.name}</strong>
                      <small>{category.description}</small>
                    </span>
                    <b>›</b>
                  </button>

                  <div className="category-submenu">
                    {categoryTeachers.map((teacher) => (
                      <button
                        className={`category-teacher ${teacher.id === selectedTeacher.id ? "active" : ""}`}
                        key={teacher.id}
                        onClick={() => selectTeacher(teacher.id)}
                        type="button"
                      >
                        <Avatar teacher={teacher} />
                        <span>
                          <strong>{teacher.name}</strong>
                          <small>{teacher.intro}</small>
                          <em>{teacher.direction}</em>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <section className="chat-panel">
          <div className="chat-header">
            <Avatar teacher={selectedTeacher} />
            <div>
              <p>{selectedTeacher.name}</p>
              <span>{selectedTeacher.direction}</span>
            </div>
          </div>

          <div className="chat-window">
            {messages.length === 0 ? (
              <div className="empty-state">
                <h2>选择讲师后直接提问</h2>
                <p>{selectedTeacher.intro}</p>
                <div className="starter-list">
                  {starterQuestions.map((question) => (
                    <button key={question} onClick={() => sendMessage(question)} type="button">
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message, index) => (
                <article className={`message ${message.role}`} key={`${message.role}-${index}`}>
                  <span className="message-author">{message.role === "user" ? "你" : selectedTeacher.shortName}</span>
                  {message.role === "assistant" && message.structuredReply ? (
                    <StructuredReplyView reply={message.structuredReply} />
                  ) : message.role === "assistant" ? (
                    <StructuredAssistantReply content={message.content} />
                  ) : (
                    <p>{message.content}</p>
                  )}
                </article>
              ))
            )}
            {isLoading ? <div className="typing">讲师正在整理建议...</div> : null}
          </div>

          {error ? <p className="error-text">{error}</p> : null}

          <form className="chat-input" onSubmit={handleSubmit}>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={inputPlaceholder}
              rows={3}
            />
            <button disabled={isLoading} type="submit">
              发送
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}

function Avatar({ teacher }: { teacher: Teacher }) {
  return <span className={`avatar avatar-${teacher.theme}`}>{teacher.avatar}</span>;
}

function StructuredReplyView({ reply }: { reply: StructuredReply }) {
  const sectionMarkers = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

  return (
    <div className="assistant-reply structured-reply">
      {reply.sections.map((section, sectionIndex) => (
        <section className="structured-section" key={`${sectionIndex}-${section.title}`}>
          <h3>
            <span>{sectionMarkers[sectionIndex] || sectionIndex + 1}</span>
            {section.title}
          </h3>
          {section.items.length > 0 ? (
            <ol className="structured-list">
              {section.items.map((item, itemIndex) => (
                <StructuredReplyListItem item={item} key={`${itemIndex}-${item.text}`} />
              ))}
            </ol>
          ) : null}
        </section>
      ))}
      {reply.summary ? <p className="structured-summary">本次总结：{reply.summary}</p> : null}
    </div>
  );
}

function StructuredReplyListItem({ item }: { item: StructuredReplyItem }) {
  const hasSingleChild = item.children?.length === 1;

  return (
    <li>
      <span>{item.text}</span>
      {hasSingleChild ? (
        <p className="structured-single-child">{item.children?.[0].text}</p>
      ) : item.children?.length ? (
        <ol>
          {item.children.map((child, index) => (
            <StructuredReplyListItem item={child} key={`${index}-${child.text}`} />
          ))}
        </ol>
      ) : null}
    </li>
  );
}

type ReplyItem = {
  kind: "section" | "number" | "subnumber" | "letter" | "text" | "summary";
  marker: string;
  text: string;
};

const sectionPattern = new RegExp("^([\\u4e00\\u4e8c\\u4e09\\u56db\\u4e94\\u516d\\u4e03\\u516b\\u4e5d\\u5341]+)[\\u3001.\\uFF0E]\\s*(.+)$");
const numberPattern = new RegExp("^(\\d+)[.\\uFF0E]\\s*(.+)$");
const letterPattern = new RegExp("^([a-zA-Z])[.\\uFF0E]\\s*(.+)$");
const markerOnlyPattern = new RegExp("^([\\u4e00\\u4e8c\\u4e09\\u56db\\u4e94\\u516d\\u4e03\\u516b\\u4e5d\\u5341]+|\\d{1,2}|[a-zA-Z])[\\u3001.\\uFF0E]?$");
const headingTextPattern = /(优先级|重点|三件事|准备|建议|动作|策略|步骤|顺序|结论|风险|判断|方案|框架|原则|清单)/;

function getDisplayMarker(marker: string) {
  if (/^\d{2}$/.test(marker) && marker !== "10") {
    return marker.slice(-1);
  }

  return marker;
}

function normalizeReplyLines(content: string) {
  const rawLines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const lines: string[] = [];

  for (let index = 0; index < rawLines.length; index += 1) {
    const markerOnly = rawLines[index].match(markerOnlyPattern);

    if (markerOnly && rawLines[index + 1]) {
      const marker = getDisplayMarker(markerOnly[1]);
      const delimiter = /^[a-zA-Z0-9]+$/.test(marker) ? "." : "\u3001";
      lines.push(`${marker}${delimiter} ${rawLines[index + 1]}`);
      index += 1;
      continue;
    }

    lines.push(rawLines[index]);
  }

  return lines;
}

function parseRawReplyItem(line: string): ReplyItem {
  const sectionMatch = line.match(sectionPattern);
  const numberMatch = line.match(numberPattern);
  const letterMatch = line.match(letterPattern);

  if (sectionMatch) {
    return { kind: "section", marker: sectionMatch[1], text: sectionMatch[2] };
  }

  if (numberMatch) {
    return { kind: "number", marker: getDisplayMarker(numberMatch[1]), text: numberMatch[2] };
  }

  if (letterMatch) {
    return { kind: "letter", marker: letterMatch[1].toLowerCase(), text: letterMatch[2] };
  }

  return {
    kind: /^本次总结[：:]/.test(line) ? "summary" : "text",
    marker: "",
    text: line || "\u00a0"
  };
}

function isHeadingLike(text: string) {
  const normalized = text.replace(/[：:]\s*$/, "");
  return normalized.length <= 28 && headingTextPattern.test(normalized);
}

function parseReplyItems(content: string): ReplyItem[] {
  let topNumber = 0;
  let subNumber = 0;
  let inSubList = false;

  return normalizeReplyLines(content).map((line) => {
    const item = parseRawReplyItem(line);

    if (item.kind === "section" || item.kind === "text" || item.kind === "summary") {
      topNumber = item.kind === "section" ? 0 : topNumber;
      subNumber = 0;
      inSubList = false;
      return item;
    }

    if (item.kind === "letter") {
      return item;
    }

    const value = Number(item.marker);

    if (!Number.isFinite(value)) {
      return item;
    }

    if (isHeadingLike(item.text)) {
      topNumber = value;
      subNumber = 0;
      inSubList = false;
      return { ...item, kind: "number" };
    }

    if (topNumber === 0 || (!inSubList && value === topNumber + 1)) {
      topNumber = value;
      subNumber = 0;
      return item;
    }

    if (value === 1 || inSubList) {
      subNumber = value;
      inSubList = true;
      return { ...item, kind: "subnumber" };
    }

    topNumber = value;
    subNumber = 0;
    inSubList = false;
    return item;
  });
}

function StructuredAssistantReply({ content }: { content: string }) {
  return (
    <div className="assistant-reply">
      {parseReplyItems(content).map((item, index) => (
        <p
          className={[
            "reply-line",
            item.kind === "section" ? "reply-section" : "",
            item.kind === "number" ? "reply-number" : "",
            item.kind === "subnumber" ? "reply-subnumber" : "",
            item.kind === "letter" ? "reply-letter" : "",
            item.kind === "text" ? "reply-text" : "",
            item.kind === "summary" ? "reply-summary" : ""
          ]
            .filter(Boolean)
            .join(" ")}
          key={`${index}-${item.marker}-${item.text}`}
        >
          {item.marker ? <span className="reply-marker">{item.marker}</span> : null}
          <span className="reply-content">{item.text}</span>
        </p>
      ))}
    </div>
  );
}
