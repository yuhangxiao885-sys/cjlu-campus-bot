# 中国计量大学校园问答机器人

基于 Next.js (App Router) + Tailwind CSS 的校园问答网页应用。通过本地 WorkBuddy 网关调用大模型，并支持在浏览器中选择或拖入本地知识库文件夹，将资料注入 System Prompt。

## 快速开始

要求 Node.js 20.9 或更高版本。

```bash
# 1. 安装依赖
npm install

# 2. 创建本地环境变量文件
cp .env.example .env.local

# 3. 编辑 .env.local，填写 WorkBuddy 网关信息
#    使用 workbuddy-to-dsh 本地桥时：
#    WORKBUDDY_BASE_URL=http://127.0.0.1:8790/v1
#    WORKBUDDY_API_KEY_FILE=C:/Users/<你>/.workbuddy-bridge/bridge-token
#    WORKBUDDY_MODEL_NAME=deepseek-v4.1-flash
#    其他网关可直接设置 WORKBUDDY_API_KEY

# 4. 启动开发服务器
npm run dev
```

打开 <http://localhost:3000>。

生产构建：

```bash
npm run build
npm start
```

## 环境变量

| 变量 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `WORKBUDDY_BASE_URL` | 否 | `http://127.0.0.1:8000/v1` | OpenAI 兼容网关地址，需带 `/v1` |
| `WORKBUDDY_API_KEY` | 二选一 | - | 本地网关密钥；若网关不校验密钥，填写任意非空字符串 |
| `WORKBUDDY_API_KEY_FILE` | 二选一 | `~/.workbuddy-bridge/bridge-token` | 令牌文件路径；设置了 `WORKBUDDY_API_KEY` 时优先使用前者 |
| `WORKBUDDY_MODEL_NAME` | 是 | - | 网关注册的模型名称 |
| `WORKBUDDY_GUARD_MODEL` | 否 | `deepseek-v4-pro` | 话题审核使用的模型；审核失败时自动改用 `glm-5.3` |

环境变量仅在服务端读取，不会暴露给浏览器。`WORKBUDDY_API_KEY_FILE` 让本地桥令牌留在用户目录，不必复制进项目。

## 接入 WorkBuddy（本地桥）

WorkBuddy 桌面端不直接提供 OpenAI 兼容接口，需要本地桥转发。推荐使用 [`Ianzhyh/workbuddy-to-dsh`](https://github.com/Ianzhyh/workbuddy-to-dsh)，它支持 WorkBuddy 5.6.2+ 的加密登录态，无需手动导出令牌。

```bash
# 1. 获取桥（放在任意目录，例如 C:\Users\<你>\workbuddy-to-dsh）
git clone --depth 1 https://github.com/Ianzhyh/workbuddy-to-dsh.git

# 2. 确认 WorkBuddy 桌面端已登录，然后启动桥
cd workbuddy-to-dsh
node bridge/launch.mjs
# 或双击 bridge/start-bridge.cmd
```

桥启动后会监听 `http://127.0.0.1:8790/v1`，并把本地令牌写入：

```text
%USERPROFILE%\.workbuddy-bridge\bridge-token
```

把本项目的 `.env.local` 改为：

```env
WORKBUDDY_BASE_URL=http://127.0.0.1:8790/v1
WORKBUDDY_API_KEY_FILE=C:/Users/<你>/.workbuddy-bridge/bridge-token
WORKBUDDY_MODEL_NAME=deepseek-v4.1-flash
```

桥可用模型：`deepseek-v4.1-flash`、`deepseek-v4-pro`、`glm-5.3`。桥控制台默认在 <http://127.0.0.1:8792>。网站和桥需要同时运行；桥进程退出后聊天会返回连接失败提示。

## 修改系统提示词

系统提示词位于 [`prompts/config.ts`](prompts/config.ts)，文件顶部有醒目提示：

```ts
// ★ 在这里修改系统提示词 ★
export const SYSTEM_PROMPT = `...`;
```

知识库正文会自动替换 `{{KNOWLEDGE_BASE}}` 占位符，请保留该占位符。开发模式下保存后会自动生效；生产模式下需要重新执行 `npm run build` 并重启网站。

与校园完全无关的问题会在服务端被话题审核拦截，统一固定回复：

> 威胁我，你也配？

该句位于同文件的 `REFUSAL_MESSAGE` 中；审核规则位于 `TOPIC_GUARD_PROMPT`。

## 知识库使用方法

1. 在左侧「校园知识库」面板点击「选择知识库文件夹」，选择本地文件夹；
2. 或直接把文件夹拖入该面板；
3. 加载成功后，聊天请求会自动把知识库内容拼接到 System Prompt；
4. 点击面板中的删除按钮可移除知识库，也可选择新文件夹直接替换。

支持 `.txt`、`.md`、`.markdown`、`.mdx`、`.json`、`.csv`、`.tsv`、`.html`、`.htm`、`.xml`、`.yaml`、`.yml`、`.log`、`.rst`、`.ini`、`.conf` 文本文件。

限制：

- 单文件最大 2 MB，总大小最大 20 MB，单次最多 500 个文件；
- 总知识库最多注入约 6 万字符，单文件最多约 2 万字符，超出部分会截断；
- 知识库保存在服务端进程内存中，**重启服务后需要重新加载文件夹**；
- 暂不解析 PDF、Word、Excel、PPT 或图片。

## 项目结构

```text
.
├── app/
│   ├── api/
│   │   ├── chat/route.ts        # 流式聊天接口，调用 WorkBuddy
│   │   └── knowledge/route.ts   # 文件夹读取、知识库状态与清空
│   ├── globals.css              # Tailwind 主题、Markdown 与动画样式
│   ├── icon.svg                 # 站点图标
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── chat-app.tsx             # 主聊天界面、会话历史、流式渲染
│   ├── icons.tsx                # 内联 SVG 图标
│   ├── knowledge-panel.tsx      # 知识库面板、文件夹选择与拖拽读取
│   └── markdown-message.tsx     # Markdown 消息渲染
├── hooks/
│   └── use-knowledge-base.ts    # 知识库上传、清空与状态
├── lib/
│   ├── knowledge-constants.ts   # 文件格式、大小与字符限制
│   ├── knowledge-store.ts       # 服务端内存知识库
│   ├── prompt.ts                # 将知识库拼接到 System Prompt
│   └── types.ts
├── prompts/
│   └── config.ts                # ★ 在这里修改系统提示词
├── .env.example
├── next.config.ts
├── package.json
└── tsconfig.json
```

## 请求流程

```text
浏览器选择文件夹
  → POST /api/knowledge（解析文本文件并存入服务端内存）
  → POST /api/chat
  → buildSystemPrompt()：SYSTEM_PROMPT + 知识库正文
  → OpenAI SDK（baseURL = WORKBUDDY_BASE_URL）
  → 流式文本逐步返回并渲染
```

## 接口说明

- `GET /api/knowledge`：获取当前知识库状态（文件名、字数、截断与跳过信息，不返回正文）
- `POST /api/knowledge`：`multipart/form-data`，字段为 `files`、`paths`、`folderName`
- `DELETE /api/knowledge`：清空当前知识库
- `POST /api/chat`：`{ "messages": [{ "role": "user", "content": "..." }] }`，返回 `text/plain` 流式回答

## 说明

- 对话历史保存在浏览器 `localStorage`，仅本机可见；
- 回答内容基于加载的知识库，重要信息请以中国计量大学官方通知为准；
- 如网关地址、密钥或模型名称填写错误，聊天界面会显示对应错误信息。
