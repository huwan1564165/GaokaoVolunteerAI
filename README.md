# GaokaoVolunteerAI

高考志愿 AI 讲师网站本地原型。

当前版本使用 Vite + React + TypeScript 前端，Node 内置 HTTP 服务作为后端 API。开发时一个命令同时启动前端和后端。

## 启动

```bash
npm run dev
```

打开：

```text
http://127.0.0.1:5173
```

后端 API 默认运行在 `http://127.0.0.1:3000`，Vite 会把 `/api` 请求代理过去。

## 当前讲师

- 张雪峰视角讲师：就业导向、专业选择、普通家庭决策。
- 院校填报讲师：位次、院校层级、冲稳保策略。
- 专业就业讲师：专业前景、职业路径、读研必要性。
- 心理沟通讲师：考后焦虑、亲子沟通、决策压力。
- 学科规划讲师：选科组合、学习难度、专业匹配。

讲师配置在：

```text
data/teachers.json
```

讲师 skill 在：

```text
teacher-skills/
```

## AI Provider

默认是 Mock 模式，不需要 API Key：

```env
AI_PROVIDER=mock
```

后续可以切换：

```env
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=你的Key
DEEPSEEK_MODEL=deepseek-chat
```

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=你的Key
GEMINI_MODEL=gemini-2.5-flash
```

```env
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=你的Key
OPENROUTER_MODEL=openrouter/auto
```

API Key 只在本地服务端环境变量中使用，不会放到浏览器端。

## 构建

```bash
npm run build
npm start
```

构建后打开：

```text
http://localhost:3000
```
