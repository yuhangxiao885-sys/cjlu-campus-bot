"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type InputHTMLAttributes,
} from "react";
import type { KnowledgeUploadItem } from "@/hooks/use-knowledge-base";
import type { KnowledgeStatus } from "@/lib/types";
import {
  AlertIcon,
  FileTextIcon,
  FolderUpIcon,
  RefreshIcon,
  SpinnerIcon,
  TrashIcon,
} from "./icons";

type KnowledgePanelProps = {
  status: KnowledgeStatus | null;
  initializing: boolean;
  uploading: boolean;
  clearing: boolean;
  error: string | null;
  notice: string | null;
  onUpload: (
    items: KnowledgeUploadItem[],
    folderName: string,
  ) => void | Promise<void>;
  onClear: () => void | Promise<void>;
};

type FsEntry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (
    success: (file: File) => void,
    failure?: (error: DOMException) => void,
  ) => void;
  createReader?: () => {
    readEntries: (
      success: (entries: FsEntry[]) => void,
      failure?: (error: DOMException) => void,
    ) => void;
  };
};

const directoryInputProps = {
  webkitdirectory: "",
  directory: "",
} as InputHTMLAttributes<HTMLInputElement>;

function formatChars(chars: number): string {
  if (chars >= 10_000) return `${(chars / 10_000).toFixed(1)} 万字`;
  return `${chars.toLocaleString("zh-CN")} 字`;
}

function getEntry(item: DataTransferItem): FsEntry | null {
  const legacyItem = item as DataTransferItem & {
    webkitGetAsEntry?: () => FsEntry | null;
  };
  return legacyItem.webkitGetAsEntry?.() ?? null;
}

function readEntryFile(entry: FsEntry): Promise<File | null> {
  return new Promise((resolve) => {
    if (!entry.file) {
      resolve(null);
      return;
    }
    entry.file(
      (file) => resolve(file),
      () => resolve(null),
    );
  });
}

async function readDirectory(entry: FsEntry): Promise<FsEntry[]> {
  const reader = entry.createReader?.();
  if (!reader) return [];

  const entries: FsEntry[] = [];
  while (true) {
    const batch = await new Promise<FsEntry[]>((resolve) => {
      reader.readEntries(
        (result) => resolve(result),
        () => resolve([]),
      );
    });
    if (batch.length === 0) break;
    entries.push(...batch);
  }
  return entries;
}

async function walkEntry(
  entry: FsEntry,
  parentPath: string,
  files: KnowledgeUploadItem[],
) {
  if (entry.isFile) {
    const file = await readEntryFile(entry);
    if (file) files.push({ file, path: `${parentPath}${entry.name}` });
    return;
  }

  if (entry.isDirectory) {
    const children = await readDirectory(entry);
    for (const child of children) {
      await walkEntry(child, `${parentPath}${entry.name}/`, files);
    }
  }
}

export function KnowledgePanel({
  status,
  initializing,
  uploading,
  clearing,
  error,
  notice,
  onUpload,
  onClear,
}: KnowledgePanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const busy = uploading || clearing;

  function openPicker() {
    if (!busy) inputRef.current?.click();
  }

  function handleFolderChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selected.length === 0) return;

    const items = selected.map((file) => ({
      file,
      path: file.webkitRelativePath || file.name,
    }));
    const folderName =
      items[0]?.path.split("/").filter(Boolean)[0] || "校园知识库";
    void onUpload(items, folderName);
  }

  async function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (busy) return;

    // 必须在第一个 await 之前同步取得目录 Entry。
    const entries = Array.from(event.dataTransfer.items ?? [])
      .map(getEntry)
      .filter((entry): entry is FsEntry => entry !== null);

    if (entries.length === 0) {
      const files = Array.from(event.dataTransfer.files ?? []);
      if (files.length > 0) {
        void onUpload(
          files.map((file) => ({ file, path: file.name })),
          "拖入的知识库",
        );
      }
      return;
    }

    const items: KnowledgeUploadItem[] = [];
    for (const entry of entries) {
      await walkEntry(entry, "", items);
    }

    const folderName =
      entries.length === 1 && entries[0].isDirectory
        ? entries[0].name
        : "拖入的知识库";

    if (items.length > 0) void onUpload(items, folderName);
  }

  function handleDragEnter(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    dragDepth.current += 1;
    if (!busy) setDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragging(false);
    }
  }

  async function handleClear() {
    if (!status?.hasUploads) return;
    if (
      !window.confirm(
        `确定移除上传的知识库“${status.folderName ?? "当前知识库"}”吗？内置的新生校园知识库会保留。`,
      )
    ) {
      return;
    }
    await onClear();
  }

  return (
    <section
      aria-label="校园知识库"
      className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/75 p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] backdrop-blur"
      onDragEnter={handleDragEnter}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={handleDragLeave}
      onDrop={(event) => void handleDrop(event)}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        aria-label="选择知识库文件夹"
        onChange={handleFolderChange}
        {...directoryInputProps}
      />

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
            <FolderUpIcon className="h-4 w-4" />
          </span>
          <h2 className="truncate text-[13px] font-semibold text-slate-700">
            校园知识库
          </h2>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-slate-400">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              status?.ready ? "bg-emerald-500" : "bg-slate-300"
            }`}
          />
          {initializing ? "读取中" : status?.ready ? "已接入" : "未加载"}
        </span>
      </div>

      {status?.ready ? (
        <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p
                className="truncate text-xs font-medium text-slate-700"
                title={status.folderName ?? ""}
              >
                {status.folderName}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {status.files.length} 个文件 · {formatChars(status.totalChars)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleClear()}
              disabled={clearing}
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-white hover:text-rose-500 disabled:opacity-50 ${
                status.hasUploads ? "" : "invisible"
              }`}
              title="移除上传的资料"
              aria-label="移除上传的资料"
            >
              {clearing ? (
                <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <TrashIcon className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          <div className="scroll-area mt-2 max-h-[126px] space-y-1 overflow-y-auto pr-1">
            {status.files.map((file) => (
              <div
                key={file.path}
                className="flex items-center gap-2 rounded-lg px-1 py-1 text-[11px] text-slate-500"
                title={file.path}
              >
                <FileTextIcon className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                <span className="min-w-0 flex-1 truncate">
                  {file.path.replace(/^内置\//, "")}
                </span>
                {file.builtin && (
                  <span className="shrink-0 rounded bg-brand-50 px-1 py-0.5 text-[9px] font-medium text-brand-700">
                    内置
                  </span>
                )}
                <span className="shrink-0 text-[10px] text-slate-300">
                  {file.truncated ? "已截断" : formatChars(file.chars)}
                </span>
              </div>
            ))}
          </div>

          {status.truncated && (
            <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-[10px] leading-4 text-amber-700">
              知识库较长，部分内容已截断以适配模型上下文。
            </p>
          )}
        </div>
      ) : null}

      <button
        type="button"
        onClick={openPicker}
        disabled={busy}
        className={`group mt-3 flex w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-3 py-3.5 text-center transition disabled:cursor-wait ${
          status?.ready
            ? "border-slate-200 bg-transparent hover:border-brand-300 hover:bg-brand-50/50"
            : "border-brand-200 bg-brand-50/50 hover:border-brand-300 hover:bg-brand-50"
        }`}
      >
        {uploading ? (
          <SpinnerIcon className="h-5 w-5 animate-spin text-brand-600" />
        ) : status?.ready ? (
          <RefreshIcon className="h-4 w-4 text-slate-400 group-hover:text-brand-600" />
        ) : (
          <FolderUpIcon className="h-5 w-5 text-brand-600" />
        )}
        <span className="text-[12px] font-medium text-slate-700">
          {uploading
            ? "正在读取文件夹…"
            : status?.ready
              ? status.hasUploads
                ? "更换上传的资料"
                : "添加自己的资料"
              : "选择知识库文件夹"}
        </span>
        <span className="text-[10px] leading-4 text-slate-400">
          {status?.ready
            ? status.hasUploads
              ? "也可以直接拖入新的文件夹"
              : "内置新生知识库已生效，可再补充自己的资料"
            : "支持 md / txt / json / csv 等文本文件"}
        </span>
      </button>

      {notice && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-slate-50 px-2 py-1.5 text-[10px] leading-4 text-slate-500">
          <AlertIcon className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{notice}</span>
        </p>
      )}

      {error && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-rose-50 px-2 py-1.5 text-[10px] leading-4 text-rose-600">
          <AlertIcon className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="break-words">{error}</span>
        </p>
      )}

      {status?.skippedFiles.length ? (
        <p
          className="mt-2 text-[10px] leading-4 text-amber-600"
          title={status.skippedFiles.join("\n")}
        >
          有 {status.skippedFiles.length} 个文件未纳入知识库
        </p>
      ) : null}

      {dragging && (
        <div className="pointer-events-none absolute inset-1 z-10 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-400 bg-brand-50/95 text-brand-700 backdrop-blur-sm">
          <FolderUpIcon className="h-7 w-7" />
          <p className="text-xs font-semibold">松手即可读取文件夹</p>
        </div>
      )}
    </section>
  );
}
