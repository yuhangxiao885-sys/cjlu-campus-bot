import ChatApp from "@/components/chat-app";

type ChatPageProps = {
  searchParams: Promise<{ new?: string | string[] }>;
};

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const params = await searchParams;
  return <ChatApp startNew={params.new === "1"} />;
}
