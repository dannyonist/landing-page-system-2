import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-stone-900 dark:bg-stone-100 mb-4">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-stone-100 dark:text-stone-900">
              <path d="M3 12L8 7L12 11L21 4M21 4H15M21 4V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Landing Page Studio</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">Sign in to your workspace</p>
        </div>
        <div className="bg-white dark:bg-stone-900 p-6 rounded-xl border border-stone-200 dark:border-stone-800">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
