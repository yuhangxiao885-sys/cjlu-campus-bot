import Link from "next/link";
import {
  ArrowRightIcon,
  GraduationCapIcon,
} from "@/components/icons";

export default function HomePage() {
  return (
    <div className="relative h-[100dvh] w-full overflow-y-auto bg-[#04101f]">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[#04101f]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-cover"
        style={{
          backgroundImage: "url('/cjlu-wallpaper.jpg')",
          backgroundPosition: "center 38%",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[linear-gradient(180deg,rgba(3,10,25,0.68)_0%,rgba(3,10,25,0.16)_20%,rgba(3,10,25,0.22)_34%,rgba(3,10,25,0.66)_64%,rgba(3,10,25,0.94)_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_72%_52%_at_50%_56%,rgba(3,10,25,0.52)_0%,rgba(3,10,25,0.18)_62%,transparent_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(125%_100%_at_50%_50%,transparent_55%,rgba(3,10,25,0.42)_100%)]"
      />

      <div className="relative z-10 flex min-h-[100dvh] flex-col">
        <header className="flex items-center justify-between px-5 py-5 md:px-10 md:py-7">
          <div className="flex min-w-0 items-center gap-3 md:hidden">
            <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-[14px] border border-white/20 bg-white/10 text-white shadow-[0_14px_32px_-16px_rgba(0,0,0,0.8)] backdrop-blur">
              <GraduationCapIcon className="h-[19px] w-[19px]" />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0a1a30] bg-gold-400" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold tracking-tight text-white">
                中国计量大学
              </p>
              <p className="mt-0.5 text-[10px] tracking-[0.14em] text-white/50">
                校园问答机器人
              </p>
            </div>
          </div>

          <span className="ml-auto hidden items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-[10px] tracking-[0.16em] text-white/60 backdrop-blur sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
            2026 新生版 · Campus AI
          </span>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center px-5 pb-10 pt-6 text-center md:px-8 md:pb-16">
          <div className="animate-fade-up w-full max-w-[780px] translate-y-[6vh] md:translate-y-[8vh]">
            <h1 className="text-[32px] font-semibold leading-[1.22] tracking-tight text-white drop-shadow-[0_4px_26px_rgba(3,10,25,0.6)] md:text-[52px]">
              你好，我是
              <span className="bg-gradient-to-r from-gold-100 via-gold-300 to-gold-500 bg-clip-text text-transparent">
                量大校园助手
              </span>
            </h1>

            <p className="mx-auto mt-4 max-w-[560px] text-[13px] leading-6 text-white/70 md:mt-5 md:text-[15px] md:leading-7">
              校园概况、学习资源、生活服务与办事流程，
              <br className="hidden sm:block" />
              关于中国计量大学的问题，都可以直接问我。
            </p>

            <div className="mt-8 flex flex-col items-center gap-4 md:mt-9">
              <Link
                href="/chat?new=1"
                className="group inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 px-8 py-3.5 text-[15px] font-semibold text-brand-950 shadow-[0_18px_50px_-16px_rgba(234,198,106,0.65)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_60px_-16px_rgba(234,198,106,0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-200 md:px-10 md:py-4 md:text-base"
              >
                开启新对话
                <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-1" />
              </Link>

              <span className="flex items-center gap-1.5 text-[11px] text-white/55">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                已内置新生校园知识库 · 由 WorkBuddy 模型回答
              </span>
            </div>
          </div>
        </main>

        <footer className="flex items-center justify-between gap-4 px-5 pb-5 text-[10px] text-white/40 md:px-10 md:pb-7">
          <span>© 2026 中国计量大学 · 量大校园助手</span>
          <span className="hidden text-right sm:inline">
            回答由 WorkBuddy 模型生成 · 重要信息以学校官方通知为准
          </span>
        </footer>
      </div>
    </div>
  );
}
