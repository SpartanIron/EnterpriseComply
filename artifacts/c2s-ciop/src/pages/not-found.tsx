import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4" data-testid="not-found">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">404 — Path Not Found</div>
      <div className="text-5xl font-mono font-bold text-foreground">404</div>
      <Link href="/">
        <button className="text-[10px] font-mono uppercase tracking-widest border border-border px-4 py-2 hover:bg-muted transition-colors">
          Return to Command Dashboard
        </button>
      </Link>
    </div>
  );
}
