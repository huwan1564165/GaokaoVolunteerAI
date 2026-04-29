# GaokaoVolunteerAI

AI 讲师网站本地原型。当前保留张雪峰视角讲师，并新增塔罗讲师和命理专家。

当前版本使用 Vite + React + TypeScript 前端，Node 内置 HTTP 服务作为后端 API。开发时一个命令同时启动前端和后端。

## 启动

```bash
npm install
npm run dev
```

打开：

```text
http://127.0.0.1:5173
```

后端 API 默认运行在 `http://127.0.0.1:3000`，Vite 会把 `/api` 请求代理过去。

## 当前讲师

- 张雪峰视角讲师：就业导向、专业选择、普通家庭决策。
- 塔罗讲师：塔罗牌阵、当下能量、关系与行动建议。
- 命理专家：八字、紫微、塔罗、西占、数字命理、奇门、六爻、梅花、风水与择时。

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

### OpenAI 官方或兼容接口

项目支持 OpenAI-compatible API。新建 `.env.local`：

```env
AI_PROVIDER=openai
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=你的Key
OPENAI_MODEL=gpt-4o-mini
```

如果是你自己的兼容网关，例如：

```env
AI_PROVIDER=openai
OPENAI_BASE_URL=http://82.38.60.68:8080
OPENAI_API_KEY=你的Key
OPENAI_MODEL=你的模型名
```

后端会自动请求：

```text
{OPENAI_BASE_URL}/v1/chat/completions
```

如果你的 `OPENAI_BASE_URL` 已经写到 `/v1` 或 `/v1/chat/completions`，后端也会自动兼容。

### 其他 Provider

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
