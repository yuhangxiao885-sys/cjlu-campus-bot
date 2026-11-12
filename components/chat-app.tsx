"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type UIEvent,
} from "react";
import { useKnowledgeBase } from "@/hooks/use-knowledge-base";
import type { ChatMessage, ChatSession } from "@/lib/types";
import { KnowledgePanel } from "./knowledge-panel";
import { MarkdownMessage } from "./markdown-message";
import {
  AlertIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  BookIcon,
  CheckIcon,
  CopyIcon,
  GraduationCapIcon,
  MenuIcon,
  MessageIcon,
  PlusIcon,
  ShieldIcon,
  SparklesIcon,
  SpinnerIcon,
  StopIcon,
  TrashIcon,
  XIcon,
} from "./icons";

const SESSIONS_KEY = "cim-campus-assistant:sessions:v1";
const ACTIVE_KEY = "cim-campus-assistant:active:v1";
const MAX_SESSIONS = 30;
const MAX_MESSAGES_PER_SESSION = 100;

const SUGGESTIONS = [
  {
    topic: "校园概况",
    question: "学校有几个校区？分别在哪里？",
  },
  {
    topic: "学习资源",
    question: "图书馆的开放时间是什么？",
  },
  {
    topic: "校园生活",
    question: "校园卡丢失后应该如何补办？",
  },
  {
    topic: "办事指南",
    question: "学校有哪些常用的校园服务电话？",
  },
];

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function compactText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function makeTitle(content: string): string {
  const text = compactText(content);
  return text.length > 22 ? `${text.slice(0, 22)}…` : text;
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Partial<ChatMessage>;
  return (
    typeof message.id === "string" &&
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string" &&
    typeof message.createdAt === "number"
  );
}

function isChatSession(value: unknown): value is ChatSession {
  if (typeof value !== "object" || value === null) return false;
  const session = value as Partial<ChatSession>;
  return (
    typeof session.id === "string" &&
    typeof session.title === "string" &&
    Array.isArray(session.messages) &&
    session.messages.every(isChatMessage) &&
    typeof session.createdAt === "number" &&
    typeof session.updatedAt === "number"
  );
}

function readStoredSessions(): ChatSession[] {
  try {
    const raw = window.localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isChatSession).slice(0, MAX_SESSIONS);
  } catch {
    return [];
  }
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatClock(timestamp: number): string {
  const date = new Date(timestamp);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatRelative(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diff = now.getTime() - date.getTime();

  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;

  const isToday =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate();
  if (isToday) return `今天 ${formatClock(timestamp)}`;

  const isYesterday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1,
  ).toDateString();
  if (date.toDateString() === isYesterday) {
    return `昨天 ${formatClock(timestamp)}`;
  }

  if (now.getFullYear() === date.getFullYear()) {
    return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
  }
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function getApiErrorMessage(payload: unknown): string {
  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const error = (payload as { error?: unknown }).error;
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof error === "string") {
      return typeof detail === "string" && detail.trim()
        ? `${error}\n\n${detail}`
        : error;
    }
  }
  return "请求问答服务失败，请稍后重试。";
}

function TypingDots() {
  return (
    <div
      className="flex h-6 items-center gap-1.5"
      aria-label="正在生成回答"
    >
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
    </div>
  );
}

type WelcomeProps = {
  ready: boolean;
  initializing: boolean;
  folderName: string | null;
  fileCount: number;
  isStreaming: boolean;
  onSuggestion: (question: string) => void;
  onOpenKnowledge: () => void;
};

function Welcome({
  ready,
  initializing,
  folderName,
  fileCount,
  isStreaming,
  onSuggestion,
  onOpenKnowledge,
}: WelcomeProps) {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-10 md:px-6">
      <div className="w-full max-w-[700px] animate-fade-up text-center">
        <div className="relative mx-auto mb-7 h-[84px] w-[84px]">
          <div className="absolute inset-0 rotate-6 rounded-[30px] bg-gradient-to-br from-brand-600 to-brand-900 shadow-[0_24px_44px_-18px_rgba(14,76,148,0.55)]" />
          <div className="absolute inset-[5px] rounded-[25px] border border-white/15 bg-white/[0.04]" />
          <GraduationCapIcon className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 text-white" />
          <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-[3px] border-white bg-gold-400 shadow-sm" />
          <span className="absolute -bottom-2 -left-2 h-6 w-6 rounded-full border border-brand-100 bg-white/80 backdrop-blur" />
        </div>

        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-white/70 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-brand-600 shadow-sm">
          <SparklesIcon className="h-3 w-3 text-gold-500" />
          China Jiliang University · Campus AI
        </div>

        <h2 className="text-[28px] font-semibold leading-tight tracking-tight text-slate-900 md:text-[38px]">
          你好，我是
          <span className="bg-gradient-to-r from-brand-600 to-brand-800 bg-clip-text text-transparent">
            量大校园助手
          </span>
        </h2>
        <p className="mx-auto mt-3 max-w-[520px] text-[13px] leading-6 text-slate-600 md:text-sm md:leading-7">
          关于中国计量大学的校园概况、学习资源、生活服务与办事流程，
          <br className="hidden sm:block" />
          都可以在这里找到答案。
        </p>

        {initializing ? (
          <div className="mx-auto mt-5 flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-[11px] text-slate-500">
            <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
            正在检查校园知识库…
          </div>
        ) : ready ? (
          <div className="mx-auto mt-5 flex max-w-[560px] items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-2.5 text-[11px] text-emerald-700">
            <span className="mr-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
            <span className="truncate">
              已接入《{folderName ?? "校园知识库"}》· {fileCount} 份资料
            </span>
          </div>
        ) : (
          <div className="mx-auto mt-5 flex max-w-[560px] items-start gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/70 p-3.5 text-left">
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-amber-800">
                还没有加载校园知识库
              </p>
              <p className="mt-1 text-[11px] leading-5 text-amber-700/80">
                在左侧面板选择学校资料文件夹后，回答会更准确。
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenKnowledge}
              className="shrink-0 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-medium text-amber-700 shadow-sm transition hover:bg-amber-100 md:hidden"
            >
              去加载
            </button>
          </div>
        )}

        <div className="mt-8 text-left">
          <div className="mb-2.5 flex items-center justify-between px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              试试这样问
            </p>
            <span className="text-[10px] text-slate-400">点击直接提问</span>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {SUGGESTIONS.map((item, index) => (
              <button
                key={item.question}
                type="button"
                disabled={isStreaming}
                onClick={() => onSuggestion(item.question)}
                className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/75 p-3.5 text-left shadow-[0_2px_10px_rgba(15,23,42,0.02)] transition hover:-translate-y-0.5 hover:border-brand-200 hover:bg-white hover:shadow-[0_14px_30px_-18px_rgba(14,76,148,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-[10px] font-semibold tracking-wide text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[9px] font-medium uppercase tracking-[0.14em] text-slate-400">
                    {item.topic}
                  </span>
                  <span className="mt-0.5 block truncate text-[12.5px] text-slate-700">
                    {item.question}
                  </span>
                </span>
                <ArrowRightIcon className="h-3.5 w-3.5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type ChatAppProps = {
  startNew?: boolean;
};

export default function ChatApp({ startNew = false }: ChatAppProps) {
  const knowledge = useKnowledgeBase();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamingRef = useRef(false);
  const stickToBottom = useRef(true);

  const activeSession = sessions.find((session) => session.id === activeId) ?? null;
  const activeMessages = activeSession?.messages ?? [];

  useEffect(() => {
    const stored = readStoredSessions();
    setSessions(stored);

    let savedActive: string | null = null;
    try {
      savedActive = window.localStorage.getItem(ACTIVE_KEY);
    } catch {
      savedActive = null;
    }
    setActiveId(
      startNew
        ? null
        : savedActive && stored.some((session) => session.id === savedActive)
          ? savedActive
          : stored[0]?.id ?? null,
    );
    setHydrated(true);
  }, [startNew]);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          SESSIONS_KEY,
          JSON.stringify(sessions.slice(0, MAX_SESSIONS)),
        );
      } catch {
        // 浏览器存储空间不足时不影响当前对话。
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [sessions, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (activeId) window.localStorage.setItem(ACTIVE_KEY, activeId);
      else window.localStorage.removeItem(ACTIVE_KEY);
    } catch {
      // 忽略隐私模式下的存储异常。
    }
  }, [activeId, hydrated]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    const nextHeight = Math.min(textarea.scrollHeight, 168);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > 168 ? "auto" : "hidden";
  }, [input]);

  useEffect(() => {
    if (!stickToBottom.current) return;
    const frame = window.requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ block: "end" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeId, activeSession?.messages, isStreaming]);

  useEffect(() => {
    if (
      hydrated &&
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 768px)").matches
    ) {
      textareaRef.current?.focus();
    }
  }, [hydrated]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const updateAssistantMessage = useCallback(
    (
      sessionId: string,
      messageId: string,
      update:
        | Partial<ChatMessage>
        | ((message: ChatMessage) => Partial<ChatMessage>),
    ) => {
      setSessions((previous) =>
        previous.map((session) => {
          if (session.id !== sessionId) return session;
          return {
            ...session,
            updatedAt: Date.now(),
            messages: session.messages.map((message) => {
              if (message.id !== messageId) return message;
              const patch =
                typeof update === "function" ? update(message) : update;
              return { ...message, ...patch };
            }),
          };
        }),
      );
    },
    [],
  );

  const sendMessage = useCallback(
    async (override?: string) => {
      const content = (override ?? input).trim();
      if (!content || streamingRef.current) return;

      const currentSession =
        sessions.find((session) => session.id === activeId) ?? null;
      const priorMessages = currentSession
        ? currentSession.messages.filter(
            (message) =>
              message.role === "user" ||
              (message.role === "assistant" &&
                message.content.trim() &&
                !message.isError),
          )
        : [];

      const sessionId = currentSession?.id ?? createId();
      const now = Date.now();
      const userMessage: ChatMessage = {
        id: createId(),
        role: "user",
        content,
        createdAt: now,
      };
      const assistantMessage: ChatMessage = {
        id: createId(),
        role: "assistant",
        content: "",
        createdAt: now + 1,
      };

      if (currentSession) {
        setSessions((previous) =>
          previous.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  messages: [
                    ...session.messages,
                    userMessage,
                    assistantMessage,
                  ].slice(-MAX_MESSAGES_PER_SESSION),
                  updatedAt: now,
                }
              : session,
          ),
        );
      } else {
        const newSession: ChatSession = {
          id: sessionId,
          title: makeTitle(content),
          messages: [userMessage, assistantMessage],
          createdAt: now,
          updatedAt: now,
        };
        setSessions((previous) =>
          [newSession, ...previous].slice(0, MAX_SESSIONS),
        );
        setActiveId(sessionId);
      }

      setInput("");
      setSidebarOpen(false);
      stickToBottom.current = true;
      setIsStreaming(true);
      streamingRef.current = true;

      const controller = new AbortController();
      abortRef.current = controller;

      const apiMessages = [
        ...priorMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        { role: "user" as const, content },
      ].slice(-20);

      let answer = "";

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            ...(knowledge.promptContext
              ? { knowledge: knowledge.promptContext }
              : {}),
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const payload: unknown = await response.json().catch(() => null);
          throw new Error(getApiErrorMessage(payload));
        }
        if (!response.body) {
          throw new Error("问答服务没有返回内容，请稍后重试。");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          answer += decoder.decode(value, { stream: true });
          updateAssistantMessage(sessionId, assistantMessage.id, {
            content: answer,
          });
        }
        answer += decoder.decode();

        if (!answer.trim()) {
          updateAssistantMessage(sessionId, assistantMessage.id, {
            content: "抱歉，本次没有生成有效回答，请稍后再试。",
            isError: true,
          });
        } else {
          updateAssistantMessage(sessionId, assistantMessage.id, {
            content: answer,
          });
        }
      } catch (error) {
        if (controller.signal.aborted) {
          updateAssistantMessage(sessionId, assistantMessage.id, (message) =>
            message.content
              ? {}
              : { content: "已停止生成。", isError: true },
          );
        } else {
          console.error("[chat] 请求失败：", error);
          const message =
            error instanceof Error
              ? error.message
              : "请求失败，请检查网络后重试。";
          updateAssistantMessage(sessionId, assistantMessage.id, {
            content: answer.trim()
              ? `${answer}\n\n[回答生成中断：${message}]`
              : message,
            isError: true,
          });
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          streamingRef.current = false;
          setIsStreaming(false);
        }
      }
    },
    [activeId, input, knowledge.promptContext, sessions, updateAssistantMessage],
  );

  function stopGenerating() {
    abortRef.current?.abort();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      if (!streamingRef.current) void sendMessage();
    }
  }

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    stickToBottom.current =
      element.scrollHeight - element.scrollTop - element.clientHeight < 120;
  }

  function openSession(sessionId: string) {
    stickToBottom.current = true;
    setActiveId(sessionId);
    setInput("");
    setSidebarOpen(false);
  }

  function startNewChat() {
    abortRef.current?.abort();
    stickToBottom.current = true;
    setActiveId(null);
    setInput("");
    setSidebarOpen(false);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function deleteSession(sessionId: string) {
    const target = sessions.find((session) => session.id === sessionId);
    if (!target) return;
    if (!window.confirm(`确定删除对话“${target.title}”吗？此操作不可撤销。`)) {
      return;
    }

    if (sessionId === activeId) {
      abortRef.current?.abort();
    }

    const remaining = sessions.filter((session) => session.id !== sessionId);
    setSessions(remaining);
    if (sessionId === activeId) {
      setActiveId(remaining[0]?.id ?? null);
    }
  }

  async function copyMessage(message: ChatMessage) {
    if (!navigator.clipboard || !message.content) return;
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      window.setTimeout(() => {
        setCopiedId((current) => (current === message.id ? null : current));
      }, 1600);
    } catch {
      setCopiedId(null);
    }
  }

  const ready = Boolean(knowledge.status?.ready);
  const hasConversation = Boolean(
    activeSession && activeMessages.length > 0,
  );

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden">
      <div aria-hidden="true" className="page-aurora" />

      <div className="relative mx-auto flex h-full w-full max-w-[1560px] md:gap-4 md:p-4 xl:p-5">
        {sidebarOpen && (
          <button
            type="button"
            aria-label="关闭侧边栏"
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-slate-950/30 backdrop-blur-[2px] md:hidden"
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-40 w-[min(88vw,336px)] p-3 transition-transform duration-300 ease-out md:static md:z-auto md:w-[310px] md:translate-x-0 md:p-0 lg:w-[326px] xl:w-[342px] ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-full flex-col overflow-hidden rounded-[26px] border border-white/70 bg-white/80 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.38)] backdrop-blur-xl">
            <div className="flex items-center justify-between px-4 pb-3 pt-4 md:px-5 md:pt-5">
              <Link
                href="/"
                title="返回主页"
                aria-label="返回主页"
                className="flex min-w-0 items-center gap-3 rounded-xl transition hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
              >
                <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-gradient-to-br from-brand-700 to-brand-900 text-white shadow-[0_10px_24px_-10px_rgba(14,76,148,0.65)]">
                  <GraduationCapIcon className="h-[19px] w-[19px]" />
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-gold-400" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold tracking-tight text-slate-800">
                    中国计量大学
                  </p>
                  <p className="mt-0.5 text-[10px] tracking-[0.14em] text-slate-400">
                    校园问答机器人
                  </p>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 md:hidden"
                aria-label="关闭侧边栏"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="px-3 md:px-4">
              <button
                type="button"
                onClick={startNewChat}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-[12.5px] font-medium text-white shadow-[0_10px_24px_-12px_rgba(14,76,148,0.7)] transition hover:bg-brand-800 active:scale-[0.99]"
              >
                <PlusIcon className="h-4 w-4" />
                开启新对话
              </button>
            </div>

            <div className="mt-3 px-3 md:px-4">
              <KnowledgePanel
                status={knowledge.status}
                initializing={knowledge.initializing}
                uploading={knowledge.uploading}
                clearing={knowledge.clearing}
                error={knowledge.error}
                notice={knowledge.notice}
                onUpload={knowledge.upload}
                onClear={knowledge.clear}
              />
            </div>

            <div className="mt-5 flex min-h-0 flex-1 flex-col">
              <div className="flex items-center justify-between px-5 pb-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  对话历史
                </p>
                <span className="text-[10px] text-slate-300">
                  {sessions.length > 0 ? `${sessions.length} 个对话` : ""}
                </span>
              </div>

              <div className="scroll-area min-h-0 flex-1 overflow-y-auto px-3 pb-3 md:px-4">
                {!hydrated ? (
                  <div className="space-y-2">
                    {[0, 1, 2].map((item) => (
                      <div
                        key={item}
                        className="h-[54px] animate-pulse rounded-xl bg-slate-100/80"
                      />
                    ))}
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-4 py-9 text-center">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-50 text-slate-300">
                      <BookIcon className="h-5 w-5" />
                    </div>
                    <p className="mt-3 text-[11px] text-slate-400">
                      还没有对话记录
                    </p>
                    <p className="mt-1 text-[10px] text-slate-300">
                      问一个校园问题，历史会自动保存在本机
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {sessions.map((session) => {
                      const active = session.id === activeId;
                      const questionCount = session.messages.filter(
                        (message) => message.role === "user",
                      ).length;
                      return (
                        <div
                          key={session.id}
                          className={`group relative flex items-center rounded-xl border transition ${
                            active
                              ? "border-brand-100 bg-brand-50/80"
                              : "border-transparent hover:border-slate-100 hover:bg-slate-50/90"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => openSession(session.id)}
                            className="flex min-w-0 flex-1 items-start gap-2.5 p-2.5 pr-8 text-left"
                          >
                            <span
                              className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${
                                active
                                  ? "bg-white text-brand-600 shadow-sm"
                                  : "bg-slate-100/80 text-slate-400"
                              }`}
                            >
                              <MessageIcon className="h-3.5 w-3.5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span
                                className={`block truncate text-[12px] ${
                                  active
                                    ? "font-medium text-brand-900"
                                    : "text-slate-600"
                                }`}
                                title={session.title}
                              >
                                {session.title}
                              </span>
                              <span className="mt-0.5 flex items-center gap-1.5 text-[9.5px] text-slate-400">
                                <span>{formatRelative(session.updatedAt)}</span>
                                {questionCount > 0 && (
                                  <>
                                    <span className="h-0.5 w-0.5 rounded-full bg-slate-300" />
                                    <span>{questionCount} 个问题</span>
                                  </>
                                )}
                              </span>
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSession(session.id)}
                            className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-slate-300 opacity-60 transition hover:bg-white hover:text-rose-500 focus:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                            aria-label={`删除对话：${session.title}`}
                            title="删除对话"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100/90 px-4 py-3 text-[10px] text-slate-400 md:px-5">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                WorkBuddy 本地网关
              </span>
              <span className="tracking-wide text-slate-300">OpenAI 兼容</span>
            </div>
          </div>
        </aside>

        <main
          className={`relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white/85 backdrop-blur-md md:rounded-[28px] md:border md:border-white/80 md:shadow-[0_30px_90px_-45px_rgba(15,23,42,0.38)] ${
            hasConversation
              ? "md:bg-white/80 md:backdrop-blur-lg"
              : "md:bg-white/60"
          }`}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-brand-50/80 via-brand-50/20 to-transparent"
          />

          <header className="relative flex h-[64px] shrink-0 items-center gap-2.5 border-b border-slate-100/80 px-3 md:h-[70px] md:px-6">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 md:hidden"
              aria-label="打开侧边栏"
            >
              <MenuIcon className="h-[18px] w-[18px]" />
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-[13px] font-semibold text-slate-800 md:text-[14px]">
                  {activeSession?.title ?? "新对话"}
                </h1>
                {isStreaming && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[9px] font-medium text-brand-600">
                    <span className="h-1 w-1 animate-pulse rounded-full bg-brand-500" />
                    生成中
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-[10px] text-slate-400">
                中国计量大学 · 专属校园助手
              </p>
            </div>

            <div
              className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] sm:flex ${
                ready
                  ? "border-emerald-100 bg-emerald-50/70 text-emerald-700"
                  : "border-amber-100 bg-amber-50/70 text-amber-700"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  ready ? "bg-emerald-500" : "bg-amber-400"
                }`}
              />
              {knowledge.initializing
                ? "检查知识库"
                : ready
                  ? "知识库已就绪"
                  : "未加载知识库"}
            </div>

            <button
              type="button"
              onClick={startNewChat}
              className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 md:hidden"
              aria-label="开启新对话"
              title="开启新对话"
            >
              <PlusIcon className="h-[18px] w-[18px]" />
            </button>

            <button
              type="button"
              onClick={() => {
                if (activeSession) deleteSession(activeSession.id);
              }}
              disabled={!activeSession || activeSession.messages.length === 0}
              className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-slate-400"
              aria-label="删除当前对话"
              title="删除当前对话"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </header>

          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="scroll-area relative min-h-0 flex-1 overflow-y-auto"
          >
            {activeSession && activeMessages.length > 0 ? (
              <div className="mx-auto flex w-full max-w-[790px] flex-col gap-7 px-4 py-6 md:px-6 md:py-8">
                {activeMessages.map((message, index) => {
                  const isLast = index === activeMessages.length - 1;
                  const streamingHere =
                    isStreaming && isLast && message.role === "assistant";

                  if (message.role === "user") {
                    return (
                      <article
                        key={message.id}
                        className="animate-message-in flex justify-end pl-8 md:pl-16"
                      >
                        <div className="max-w-[86%] rounded-[22px] rounded-br-md bg-gradient-to-br from-brand-700 to-brand-900 px-4 py-3 text-[13.5px] leading-6 text-white shadow-[0_12px_30px_-18px_rgba(14,76,148,0.8)] md:px-5 md:py-3.5 md:text-[14px] md:leading-7">
                          <p className="whitespace-pre-wrap break-words">
                            {message.content}
                          </p>
                        </div>
                      </article>
                    );
                  }

                  return (
                    <article
                      key={message.id}
                      className="group/message animate-message-in flex gap-3 md:gap-4"
                    >
                      <div className="mt-[22px] grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-900 text-white shadow-[0_8px_20px_-10px_rgba(14,76,148,0.7)]">
                        <GraduationCapIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-slate-600">
                            量大助手
                          </span>
                          <span className="text-[9.5px] text-slate-300">
                            {formatClock(message.createdAt)}
                          </span>
                        </div>
                        <div
                          className={`max-w-[min(100%,720px)] rounded-[22px] rounded-tl-md border px-4 py-3.5 shadow-[0_4px_24px_-18px_rgba(15,23,42,0.25)] md:px-5 md:py-4 ${
                            message.isError
                              ? "border-rose-200/80 bg-rose-50/80"
                              : "border-slate-200/70 bg-white/90"
                          }`}
                        >
                          {message.isError && (
                            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-rose-600">
                              <AlertIcon className="h-3.5 w-3.5" />
                              回答未完成
                            </div>
                          )}
                          {message.content ? (
                            <MarkdownMessage content={message.content} />
                          ) : streamingHere ? (
                            <TypingDots />
                          ) : null}
                          {streamingHere && message.content && (
                            <span className="streaming-caret" />
                          )}
                        </div>
                        {message.content && !streamingHere && (
                          <button
                            type="button"
                            onClick={() => void copyMessage(message)}
                            className="mt-1.5 flex items-center gap-1 rounded-md px-1 py-1 text-[10px] text-slate-400 opacity-70 transition hover:text-brand-600 focus:opacity-100 md:opacity-0 md:group-hover/message:opacity-100"
                          >
                            {copiedId === message.id ? (
                              <>
                                <CheckIcon className="h-3 w-3 text-emerald-500" />
                                已复制
                              </>
                            ) : (
                              <>
                                <CopyIcon className="h-3 w-3" />
                                复制回答
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
                <div ref={bottomRef} className="h-1" />
              </div>
            ) : (
              <Welcome
                ready={ready}
                initializing={knowledge.initializing}
                folderName={knowledge.status?.folderName ?? null}
                fileCount={knowledge.status?.files.length ?? 0}
                isStreaming={isStreaming}
                onSuggestion={(question) => void sendMessage(question)}
                onOpenKnowledge={() => setSidebarOpen(true)}
              />
            )}
          </div>

          <div className="relative shrink-0 px-3 pb-3 pt-2 md:px-6 md:pb-5 md:pt-3">
            <div className="mx-auto w-full max-w-[790px]">
              <form
                onSubmit={handleSubmit}
                className="flex items-end gap-2 rounded-[24px] border border-slate-200/90 bg-white p-1.5 pl-4 shadow-[0_18px_44px_-25px_rgba(15,23,42,0.35)] transition focus-within:border-brand-300 focus-within:shadow-[0_20px_50px_-25px_rgba(14,76,148,0.35)] md:pl-5"
              >
                <textarea
                  ref={textareaRef}
                  value={input}
                  rows={1}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入你的校园问题，例如：图书馆几点开门？"
                  aria-label="输入你的校园问题"
                  className="max-h-[168px] min-h-[38px] flex-1 resize-none bg-transparent py-2 text-[14px] leading-6 text-slate-700 outline-none placeholder:text-slate-400 md:min-h-[40px] md:py-2.5 md:text-[14.5px]"
                />
                {isStreaming ? (
                  <button
                    type="button"
                    onClick={stopGenerating}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-[16px] bg-slate-900 text-white shadow-sm transition hover:bg-slate-800 active:scale-95"
                    aria-label="停止生成"
                    title="停止生成"
                  >
                    <StopIcon className="h-[18px] w-[18px]" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-[16px] bg-brand-700 text-white shadow-[0_8px_18px_-8px_rgba(14,76,148,0.7)] transition hover:bg-brand-800 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-300 disabled:shadow-none"
                    aria-label="发送问题"
                    title="发送问题"
                  >
                    <ArrowUpIcon className="h-[18px] w-[18px]" />
                  </button>
                )}
              </form>

              <div className="mt-2 flex items-center justify-between gap-3 px-2 text-[9.5px] text-slate-500">
                <span className="flex min-w-0 items-center gap-1.5">
                  <ShieldIcon className="h-3 w-3 shrink-0 text-slate-400" />
                  <span className="truncate">
                    {ready
                      ? "回答由 WorkBuddy 模型生成，知识库用于补充校准；重要信息请以学校官方通知为准"
                      : "回答由 WorkBuddy 模型生成；加载知识库可提高准确度"}
                  </span>
                </span>
                <span className="hidden shrink-0 text-slate-400 sm:inline">
                  Enter 发送 · Shift + Enter 换行
                </span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
