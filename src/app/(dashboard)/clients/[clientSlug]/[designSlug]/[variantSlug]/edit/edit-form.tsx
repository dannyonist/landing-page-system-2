"use client";
import { useState } from "react";
import { Check, Save } from "lucide-react";
import { saveVariantHtml } from "./actions";

export function EditForm({
  variantId,
  initialHtml,
}: {
  variantId: string;
  initialHtml: string;
}) {
  const [html, setHtml] = useState(initialHtml);
  const [savedHtml, setSavedHtml] = useState(initialHtml);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const dirty = html !== savedHtml;

  const handleSave = async () => {
    setSaving(true);
    await saveVariantHtml(variantId, html);
    setSavedHtml(html);
    setSaving(false);
    setSavedAt(new Date());
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="flex flex-col">
        <div className="flex items-center justify-between mb-2 h-8">
          <label className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
            HTML
          </label>
          <div className="flex items-center gap-3">
            {savedAt && !dirty && (
              <span className="inline-flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400">
                <Check className="w-3 h-3" />
                Saved
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 text-xs font-medium hover:bg-stone-800 dark:hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
        <textarea
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          spellCheck={false}
          className="w-full h-[75vh] font-mono text-xs rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 p-4 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
        />
      </div>
      <div className="flex flex-col">
        <div className="flex items-center mb-2 h-8">
          <label className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
            Preview
          </label>
        </div>
        <iframe
          srcDoc={html}
          className="w-full h-[75vh] rounded-xl border border-stone-200 dark:border-stone-800 bg-white"
        />
      </div>
    </div>
  );
}
