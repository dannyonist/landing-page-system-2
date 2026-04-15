"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, Pencil, Trash2, Loader2 } from "lucide-react";
import { PreviewTile } from "@/components/preview-tile";
import { deleteVariant } from "./actions";

type Props = {
  id: string;
  name: string;
  slug: string;
  html: string;
  clientSlug: string;
  designSlug: string;
};

export function VariantCard({
  id,
  name,
  slug,
  html,
  clientSlug,
  designSlug,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const liveUrl = `/v/${clientSlug}/${designSlug}/${slug}`;

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteVariant(id);
      } catch (e) {
        setConfirming(false);
        alert(
          e instanceof Error ? e.message : "Delete failed. Try again.",
        );
      }
    });
  }

  return (
    <div className="group block rounded-2xl border border-white/[0.08] hover:border-white/20 bg-zinc-950/50 overflow-hidden transition-all hover:-translate-y-0.5 relative">
      <Link
        href={`/clients/${clientSlug}/${designSlug}/${slug}/edit`}
        className="block"
      >
        <div className="aspect-[16/10] border-b border-white/[0.06] relative">
          <PreviewTile html={html} className="w-full h-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </Link>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold tracking-tight truncate">{name}</h3>
            <p className="text-xs text-zinc-500 font-mono mt-1 truncate">
              {liveUrl}
            </p>
          </div>
        </div>

        {!confirming && (
          <div className="flex items-center gap-1 mt-3 pt-3 border-t border-white/[0.04]">
            <a
              href={liveUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              View
            </a>
            <Link
              href={`/clients/${clientSlug}/${designSlug}/${slug}/edit`}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors"
            >
              <Pencil className="w-3 h-3" />
              Edit
            </Link>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="inline-flex items-center gap-1.5 h-7 w-7 rounded-md text-xs text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors justify-center"
              title="Delete variant"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}

        {confirming && (
          <div className="mt-3 pt-3 border-t border-red-500/20 space-y-2">
            <p className="text-xs text-zinc-300">
              Delete <strong>{name}</strong>? Its URL will 404 immediately.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={pending}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-red-500 hover:bg-red-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
              >
                {pending ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Deleting…
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3 h-3" />
                    Yes, delete
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={pending}
                className="h-7 px-2.5 rounded-md text-xs text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
