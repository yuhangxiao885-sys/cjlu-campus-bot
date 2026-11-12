import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { MAX_TOTAL_KNOWLEDGE_CHARS } from "@/lib/knowledge-constants";
import { buildSystemPrompt } from "@/lib/prompt";
import type { ApiMessage } from "@/lib/types";
import { REFUSAL_MESSAGE, TOPIC_GUARD_PROMPT } from "@/prompts/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_HISTORY_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 12_000;

const GREETING_PATTERN =
  /^(你好|您好|hi|hello|嗨|哈喽|在吗|早上好|上午好|中午好|下午好|晚上好|谢谢|多谢|感谢|再见|拜拜|晚安|你是谁|你能做什么|你可以做什么)[\s!！。.?？~～，,、呀啊哈呢哦啦]*$/i;

const CAMPUS_KEYWORDS = [
  "中国计量大学",
  "计量大学",
  "量大",
  "校区",
  "校园卡",
  "一卡通",
  "校园网",
  "逸夫",
  "博雅",
  "嘉量",
  "学源街",
  "文泽路",
  "下沙",
  "东区",
  "西区",
  "宿舍",
  "寝室",
  "食堂",
  "餐厅",
  "图书馆",
  "教务",
  "选课",
  "学分",
  "学籍",
  "成绩",
  "考试",
  "补考",
  "重修",
  "奖学金",
  "助学金",
  "助学贷款",
  "勤工",
  "辅导员",
  "班主任",
  "导师",
  "校医院",
  "医务室",
  "校历",
  "军训",
  "报到",
  "新生",
  "招生",
  "就业",
  "校招",
  "实习",
  "转专业",
  "休学",
  "退学",
  "复学",
  "评教",
  "四六级",
  "考研",
  "保研",
  "体测",
  "校园活动",
  "社团",
  "学生会",
  "校车",
  "班车",
  "门禁",
  "快递",
  "生活区",
  "教学区",
  "行政楼",
  "学生证",
  "毕业证",
  "学位证",
  "三方协议",
  "档案",
  "医保",
  "体检",
  "户口",
  "开水",
  "热水",
  "空调",
  "洗衣",
  "校规",
  "处分",
  "请假",
  "销假",
  "开学",
  "放假",
  "学费",
  "住宿费",
  "实验室",
  "竞赛",
  "志愿",
  "入党",
  "团学",
  "讲座",
  "宣讲会",
  "招聘会",
  "校门",
  "保卫处",
  "后勤",
  "学生处",
  "教务处",
];

function skipsTopicGuard(text: string): boolean {
  const normalized = text.trim();
  if (GREETING_PATTERN.test(normalized)) return true;
  return CAMPUS_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function jsonError(message: string, status: number, detail?: string) {
  return NextResponse.json(
    { error: message, ...(detail ? { detail } : {}) },
    { status },
  );
}

function resolveApiKey(): string | undefined {
  const envKey = process.env.WORKBUDDY_API_KEY?.trim();
  if (envKey) return envKey;

  const tokenFile =
    process.env.WORKBUDDY_API_KEY_FILE?.trim() ||
    join(homedir(), ".workbuddy-bridge", "bridge-token");

  try {
    const token = readFileSync(tokenFile, "utf8").trim();
    return token || undefined;
  } catch {
    return undefined;
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("请求格式不正确。", 400);
  }

  const rawMessages =
    typeof body === "object" && body !== null && "messages" in body
      ? (body as { messages?: unknown }).messages
      : undefined;

  if (!Array.isArray(rawMessages)) {
    return jsonError("缺少对话消息。", 400);
  }

  const messages: ApiMessage[] = rawMessages
    .filter(
      (message): message is { role: "user" | "assistant"; content: string } =>
        typeof message === "object" &&
        message !== null &&
        ((message as { role?: unknown }).role === "user" ||
          (message as { role?: unknown }).role === "assistant") &&
        typeof (message as { content?: unknown }).content === "string" &&
        (message as { content: string }).content.trim().length > 0,
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, MAX_MESSAGE_CHARS),
    }));

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return jsonError("请先输入问题。", 400);
  }

  const rawKnowledge =
    typeof body === "object" && body !== null && "knowledge" in body
      ? (body as { knowledge?: unknown }).knowledge
      : undefined;
  const knowledge =
    typeof rawKnowledge === "string"
      ? rawKnowledge.trim().slice(0, MAX_TOTAL_KNOWLEDGE_CHARS)
      : undefined;

  const apiKey = resolveApiKey();
  const model = process.env.WORKBUDDY_MODEL_NAME?.trim();
  const baseURL =
    process.env.WORKBUDDY_BASE_URL?.trim() || "http://127.0.0.1:8000/v1";

  if (!apiKey) {
    return jsonError(
      "尚未配置 WorkBuddy 访问令牌。请在 .env.local 设置 WORKBUDDY_API_KEY，或配置 WORKBUDDY_API_KEY_FILE 指向本地桥令牌文件。",
      500,
    );
  }
  if (!model) {
    return jsonError(
      "尚未配置 WORKBUDDY_MODEL_NAME。请在 .env.local 中填写网关使用的模型名称。",
      500,
    );
  }

  const client = new OpenAI({
    apiKey,
    baseURL,
    timeout: 90_000,
    maxRetries: 1,
  });

  const latestMessage = messages[messages.length - 1].content;
  let offTopic: boolean | undefined = skipsTopicGuard(latestMessage)
    ? false
    : undefined;
  const guardVerdicts: string[] = [];
  const guardModels = Array.from(
    new Set([
      process.env.WORKBUDDY_GUARD_MODEL?.trim() || "deepseek-v4-pro",
      "glm-5.3",
    ]),
  );
  for (const guardModel of guardModels) {
    if (offTopic !== undefined) break;
    try {
      const guard = await client.chat.completions.create(
        {
          model: guardModel,
          temperature: 0,
          max_tokens: 16,
          stream: false,
          messages: [
            { role: "system", content: TOPIC_GUARD_PROMPT },
            ...messages.slice(-6),
          ],
        },
        { timeout: 20_000 },
      );
      const verdict = (guard.choices[0]?.message?.content ?? "")
        .trim()
        .toUpperCase();
      const category = verdict.match(/[A-F]/)?.[0];
      if (category) {
        guardVerdicts.push(category);
        if (category === "A" || category === "B") {
          offTopic = false;
        }
      }
    } catch (error) {
      console.error(`[chat] 话题判定失败（${guardModel}）：`, error);
    }
  }

  if (offTopic === undefined) {
    if (guardVerdicts.length === 0) {
      return jsonError("暂时无法完成问题审核，请稍后重试。", 503);
    }
    offTopic = true;
  }

  if (offTopic) {
    return new Response(REFUSAL_MESSAGE, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  let completion;
  try {
    completion = await client.chat.completions.create({
      model,
      temperature: 0.2,
      stream: true,
      messages: [
        { role: "system", content: buildSystemPrompt(knowledge) },
        ...messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ],
    });
  } catch (error) {
    console.error("[chat] 调用 WorkBuddy 网关失败：", error);
    const detail =
      error instanceof Error ? error.message.slice(0, 400) : undefined;
    return jsonError(
      "无法连接到 WorkBuddy 模型服务。请确认本地网关已启动，并检查 .env.local 中的地址、密钥和模型名称。",
      502,
      detail,
    );
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of completion) {
          if (closed) break;
          const text = chunk.choices[0]?.delta?.content;
          if (text) controller.enqueue(encoder.encode(text));
        }
      } catch (error) {
        console.error("[chat] 流式回答中断：", error);
        if (!closed) {
          controller.enqueue(
            encoder.encode("\n\n[回答生成中断，请稍后重试。]"),
          );
        }
      } finally {
        if (!closed) {
          closed = true;
          controller.close();
        }
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
