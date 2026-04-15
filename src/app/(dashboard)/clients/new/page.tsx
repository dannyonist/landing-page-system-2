import Link from "next/link";
import { ArrowLeft, Wand2 } from "lucide-react";
import { ClientIntakeChat } from "./client-intake-chat";

export default function NewClientPage() {
  return (
    <div>
      <div className="mb-6">
        <Link
          href="/clients"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All clients
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Wand2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">New client</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Chat with AI to create a full client brief — used as permanent context when building designs and variants.
            </p>
          </div>
        </div>
      </div>

      <ClientIntakeChat />
    </div>
  );
}
