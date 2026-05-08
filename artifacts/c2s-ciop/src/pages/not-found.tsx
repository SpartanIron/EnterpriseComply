import { useLocation } from "wouter";

const BASE_PATH = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export default function NotFound() {
  const [, navigate] = useLocation();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-white" data-testid="not-found">
      <img src={`${BASE_PATH}/logo.svg`} className="h-12 w-12 opacity-50" />
      <h1 className="text-3xl font-bold text-slate-900">Page not found</h1>
      <p className="text-slate-500">The page you're looking for doesn't exist.</p>
      <button onClick={() => navigate("/dashboard")} className="px-5 py-2.5 bg-green-800 text-white text-sm font-semibold rounded-lg hover:bg-green-900 transition-colors">
        Go to Dashboard
      </button>
    </div>
  );
}
