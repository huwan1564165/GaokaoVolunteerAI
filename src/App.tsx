import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ChatMessage, StudentProfile, Teacher } from "./types";

const initialProfile: StudentProfile = {
  province: "",
  score: "",
  rank: "",
  subjects: "",
  family: "",
  targetCity: ""
};

const starterQuestions = [
  "我这个分数应该优先选学校还是专业？",
  "普通家庭学计算机还值得吗？",
  "怎么安排冲稳保比例？",
  "家长和孩子意见不一致怎么办？"
];

export default function App() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [profile, setProfile] = useState<StudentProfile>(initialProfile);
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
      .catch(() => setError("讲师列表加载失败"));
  }, []);

  const selectedTeacher = useMemo(
    () => teachers.find((teacher) => teacher.id === selectedTeacherId) || teachers[0],
    [selectedTeacherId, teachers]
  );

  function selectTeacher(id: string) {
    setSelectedTeacherId(id);
    setMessages([]);
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
          profile
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "请求失败");
      }

      setMessages([...nextMessages, { role: "assistant", content: data.reply }]);
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : "请求失败");
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
        <p>正在加载讲师...</p>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Gaokao Volunteer AI</p>
          <h1>高考志愿 AI 讲师</h1>
        </div>

        <div className="teacher-menu">
          <button className="menu-trigger" type="button">
            <Avatar teacher={selectedTeacher} />
            <span>
              <strong>{selectedTeacher.shortName}</strong>
              <small>{selectedTeacher.title}</small>
            </span>
          </button>
          <div className="menu-list">
            {teachers.map((teacher) => (
              <button
                className="menu-item"
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
      </header>

      <section className="workspace">
        <aside className="profile-panel">
          <div className="section-heading">
            <p className="eyebrow">Student Profile</p>
            <h2>学生信息</h2>
          </div>
          <div className="form-grid">
            <ProfileInput
              label="省份"
              placeholder="例如：河南"
              value={profile.province}
              onChange={(province) => setProfile({ ...profile, province })}
            />
            <ProfileInput
              label="分数"
              placeholder="例如：580"
              value={profile.score}
              onChange={(score) => setProfile({ ...profile, score })}
            />
            <ProfileInput
              label="位次"
              placeholder="例如：32000"
              value={profile.rank}
              onChange={(rank) => setProfile({ ...profile, rank })}
            />
            <ProfileInput
              label="选科"
              placeholder="例如：物化生"
              value={profile.subjects}
              onChange={(subjects) => setProfile({ ...profile, subjects })}
            />
            <ProfileInput
              label="家庭情况"
              placeholder="例如：普通家庭，求稳"
              value={profile.family}
              onChange={(family) => setProfile({ ...profile, family })}
            />
            <ProfileInput
              label="目标城市"
              placeholder="例如：南京、杭州"
              value={profile.targetCity}
              onChange={(targetCity) => setProfile({ ...profile, targetCity })}
            />
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
                <p>当前为 Mock 模式，不需要 API Key。后续切换环境变量即可接入真实模型。</p>
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
                  <span>{message.role === "user" ? "你" : selectedTeacher.shortName}</span>
                  <p>{message.content}</p>
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
              placeholder="输入你的问题，例如：河南物化生 580 分，普通家庭，想学电子信息，怎么选？"
              rows={3}
            />
            <button disabled={isLoading} type="submit">
              发送
            </button>
          </form>
        </section>
      </section>

      <section className="teacher-section">
        <div className="section-heading">
          <p className="eyebrow">AI Teachers</p>
          <h2>选择合适的讲师</h2>
        </div>
        <div className="teacher-grid">
          {teachers.map((teacher) => (
            <button
              className={`teacher-card ${teacher.id === selectedTeacher.id ? "active" : ""}`}
              key={teacher.id}
              onClick={() => selectTeacher(teacher.id)}
              type="button"
            >
              <Avatar teacher={teacher} />
              <strong>{teacher.name}</strong>
              <small>{teacher.title}</small>
              <p>{teacher.intro}</p>
              <span className="skill-row">{teacher.skills.join(" / ")}</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

function Avatar({ teacher }: { teacher: Teacher }) {
  return <span className={`avatar avatar-${teacher.theme}`}>{teacher.avatar}</span>;
}

function ProfileInput({
  label,
  placeholder,
  value,
  onChange
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}
