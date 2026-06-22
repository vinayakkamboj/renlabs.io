import type { Metadata } from "next";
import { AstraChat } from "@/components/platform/astra-chat";

export const metadata: Metadata = { title: "Chat" };
export const dynamic = "force-dynamic";

export default function ChatPage() {
  return <AstraChat />;
}
