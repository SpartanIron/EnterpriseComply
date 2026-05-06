import { Link, useLocation } from "wouter";
import {
  Shield,
  LayoutDashboard,
  CheckSquare,
  AlertTriangle,
  BookOpen,
  Server,
  Search,
  Radio,
  Network,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "@/components/ui/theme-provider";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Command", sublabel: "Dashboard" },
  { href: "/controls", icon: CheckSquare, label: "Controls", sublabel: "Validation" },
  { href: "/risks", icon: AlertTriangle, label: "Risk", sublabel: "Attack Paths" },
  { href: "/frameworks", icon: BookOpen, label: "Frameworks", sublabel: "Compliance" },
  { href: "/assets", icon: Server, label: "Assets", sublabel: "Intelligence" },
  { href: "/findings", icon: Search, label: "Findings", sublabel: "Alerts" },
  { href: "/telemetry", icon: Radio, label: "Telemetry", sublabel: "Evidence" },
  { href: "/graph", icon: Network, label: "Cyber Graph", sublabel: "Intelligence" },
];

export function Sidebar() {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();

  return (
    <aside className="flex flex-col w-16 lg:w-56 h-screen border-r border-border bg-sidebar shrink-0 fixed left-0 top-0 z-30">
      {/* Logo */}
      <div className="flex items-center gap-2 px-3 py-4 border-b border-border h-14">
        <div className="w-7 h-7 bg-foreground flex items-center justify-center shrink-0">
          <Shield className="w-4 h-4 text-background" strokeWidth={2.5} />
        </div>
        <div className="hidden lg:block overflow-hidden">
          <div className="text-[10px] font-mono font-bold tracking-widest text-foreground uppercase leading-tight">C2S-CIOP</div>
          <div className="text-[9px] font-mono text-muted-foreground tracking-wider uppercase leading-tight">ColorCode Solutions</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto" data-testid="sidebar-nav">
        {navItems.map(({ href, icon: Icon, label, sublabel }) => {
          const isActive = href === "/" ? location === "/" : location.startsWith(href);
          return (
            <Link key={href} href={href}>
              <div
                data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 mx-2 my-0.5 cursor-pointer transition-colors border",
                  isActive
                    ? "bg-foreground text-background border-foreground"
                    : "text-muted-foreground border-transparent hover:text-foreground hover:border-border hover:bg-muted"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
                <div className="hidden lg:block overflow-hidden">
                  <div className={cn("text-[11px] font-semibold uppercase tracking-widest leading-tight", isActive ? "text-background" : "text-foreground")}>{label}</div>
                  <div className={cn("text-[10px] leading-tight", isActive ? "text-background/60" : "text-muted-foreground")}>{sublabel}</div>
                </div>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Theme toggle */}
      <div className="border-t border-border p-3">
        <button
          data-testid="theme-toggle"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex items-center gap-3 px-3 py-2 w-full text-muted-foreground hover:text-foreground border border-transparent hover:border-border hover:bg-muted transition-colors"
        >
          {theme === "dark" ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
          <span className="hidden lg:block text-[11px] font-mono uppercase tracking-widest">
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </span>
        </button>
      </div>
    </aside>
  );
}
