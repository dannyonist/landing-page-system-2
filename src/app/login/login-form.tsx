"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInAction } from "./actions";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setPending(true);
        const formData = new FormData(e.currentTarget);
        const result = await signInAction(formData);
        setPending(false);
        if (result?.error) {
          setError(result.error);
        } else {
          router.push("/clients");
          router.refresh();
        }
      }}
      className="space-y-4"
    >
      <div>
        <label htmlFor="login-email" className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
          Email
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full h-9 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-shadow"
        />
      </div>
      <div>
        <label htmlFor="login-password" className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
          Password
        </label>
        <input
          id="login-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full h-9 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-shadow"
        />
      </div>
      {error && (
        <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-md p-2.5">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full h-9 rounded-md bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 text-sm font-medium hover:bg-stone-800 dark:hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
