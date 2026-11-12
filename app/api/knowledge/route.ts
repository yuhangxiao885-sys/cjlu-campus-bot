import { NextResponse } from "next/server";
import {
  MAX_FILES,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  isSupportedFile,
} from "@/lib/knowledge-constants";
import {
  clearKnowledge,
  getKnowledgePromptContext,
  getKnowledgeStatus,
  replaceKnowledge,
} from "@/lib/knowledge-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function withPromptContext(status: ReturnType<typeof getKnowledgeStatus>) {
  return {
    ...status,
    promptContext: status.ready ? getKnowledgePromptContext() : "",
  };
}

function safePath(rawPath: string, fallback: string): string {
  const path = (rawPath || fallback)
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");
  return path.slice(0, 240) || fallback.slice(0, 240);
}

function normalizeText(text: string): string {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function decodeText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let text = new TextDecoder("utf-8").decode(bytes);
  const badChars = (text.match(/\uFFFD/g) ?? []).length;

  // 兼容常见的中文 GBK 编码文件。
  if (badChars > 0 && badChars / Math.max(text.length, 1) > 0.005) {
    try {
      const gbkText = new TextDecoder("gbk").decode(bytes);
      const gbkBadChars = (gbkText.match(/\uFFFD/g) ?? []).length;
      if (gbkBadChars < badChars) text = gbkText;
    } catch {
      // 当前运行环境不支持 GBK 时继续使用 UTF-8 解码结果。
    }
  }

  return text;
}

function stripHtml(text: string): string {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}

export async function GET() {
  return NextResponse.json(withPromptContext(getKnowledgeStatus()), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function DELETE() {
  return NextResponse.json(withPromptContext(clearKnowledge()), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_TOTAL_BYTES + 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: "上传内容过大，知识库总大小不能超过 20 MB。" },
        { status: 413 },
      );
    }

    const formData = await request.formData();
    const uploads = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File);

    if (uploads.length === 0) {
      return NextResponse.json(
        { error: "没有检测到文件，请选择一个知识库文件夹后再试。" },
        { status: 400 },
      );
    }

    if (uploads.length > MAX_FILES) {
      return NextResponse.json(
        { error: `单次最多读取 ${MAX_FILES} 个文件，请缩小文件夹范围。` },
        { status: 400 },
      );
    }

    let paths: string[] = [];
    const rawPaths = formData.get("paths");
    if (typeof rawPaths === "string") {
      try {
        const parsed: unknown = JSON.parse(rawPaths);
        if (Array.isArray(parsed)) {
          paths = parsed.map((path) => (typeof path === "string" ? path : ""));
        }
      } catch {
        paths = [];
      }
    }

    const folderNameValue = formData.get("folderName");
    const folderName =
      typeof folderNameValue === "string" && folderNameValue.trim()
        ? folderNameValue.trim().slice(0, 80)
        : "校园知识库";

    const files: Array<{ path: string; content: string }> = [];
    const skippedFiles: string[] = [];
    let totalBytes = 0;

    for (const [index, upload] of uploads.entries()) {
      const path = safePath(paths[index] ?? "", upload.name);

      if (!isSupportedFile(upload.name)) {
        skippedFiles.push(`${path}（暂不支持该文件格式）`);
        continue;
      }
      if (upload.size > MAX_FILE_BYTES) {
        skippedFiles.push(`${path}（单个文件超过 2 MB）`);
        continue;
      }
      totalBytes += upload.size;
      if (totalBytes > MAX_TOTAL_BYTES) {
        skippedFiles.push(`${path}（超出知识库总大小限制）`);
        continue;
      }

      const buffer = await upload.arrayBuffer();
      if (new Uint8Array(buffer).includes(0)) {
        skippedFiles.push(`${path}（疑似二进制文件）`);
        continue;
      }

      const extension = upload.name.slice(upload.name.lastIndexOf("."));
      let content = decodeText(buffer);
      if ([".html", ".htm"].includes(extension.toLowerCase())) {
        content = stripHtml(content);
      }
      content = normalizeText(content);

      if (!content) {
        skippedFiles.push(`${path}（文件内容为空）`);
        continue;
      }

      files.push({ path, content });
    }

    if (files.length === 0) {
      return NextResponse.json(
        {
          error:
            "没有读到可用的文本内容。目前支持 .txt / .md / .json / .csv / .html 等文本格式。",
          skippedFiles,
        },
        { status: 400 },
      );
    }

    const status = replaceKnowledge({ folderName, files, skippedFiles });
    return NextResponse.json(withPromptContext(status), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[knowledge] 读取知识库失败：", error);
    return NextResponse.json(
      { error: "读取知识库失败，请检查文件后重试。" },
      { status: 500 },
    );
  }
}
