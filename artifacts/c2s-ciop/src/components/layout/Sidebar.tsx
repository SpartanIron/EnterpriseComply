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
  { href: "/graph", icon: Network, label: "Cyber Graph", sublabel: "Visualization" },
];

export function Sidebar() {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();

  return (
    <aside className="flex flex-col w-16 lg:w-60 h-screen border-r border-sidebar-border bg-sidebar shrink-0 fixed left-0 top-0 z-30">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-sidebar-border">
        <div className="w-7 h-7 bg-primary rounded flex items-center justify-center shrink-0">
          <Shield className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
        </div>
        <div className="hidden lg:block overflow-hidden">
          <div className="text-sm font-bold tracking-tight text-sidebar-foreground leading-tight">C2S-CIOP</div>
          <div className="text-[10px] text-muted-foreground leading-tight truncate">ColorCode Solutions</div>
        </div>
      </div>

      {/* Nav section label */}
      <div className="hidden lg:block px-4 pt-4 pb-1">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Navigation</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-1 overflow-y-auto" data-testid="sidebar-nav">
        {navItems.map(({ href, icon: Icon, label, sublabel }) => {
          const isActive = href === "/" ? location === "/" : location.startsWith(href);
          return (
            <Link key={href} href={href}>
              <div
                data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 my-0.5 rounded-md cursor-pointer transition-all duration-150",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
                <div className="hidden lg:block overflow-hidden">
                  <div className={cn("text-[13px] font-semibold leading-tight", isActive ? "text-primary-foreground" : "text-sidebar-foreground")}>{label}</div>
                  <div className={cn("text-[10px] leading-tight", isActive ? "text-primary-foreground/70" : "text-muted-foreground")}>{sublabel}</div>
                </div>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Divider + org info */}
      <div className="hidden lg:block px-4 pb-3 border-t border-sidebar-border pt-3">
        <div className="text-[10px] text-muted-foreground font-medium">Organization</div>
        <div className="text-xs font-semibold text-sidebar-foreground mt-0.5">Acme Federal Inc.</div>
        <div className="text-[10px] text-muted-foreground">FedRAMP Authorized</div>
      </div>

      {/* Theme toggle */}
      <div className="border-t border-sidebar-border p-2">
        <button
          data-testid="theme-toggle"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex items-center gap-3 px-3 py-2 w-full text-muted-foreground hover:text-sidebar-foreground rounded-md hover:bg-sidebar-accent transition-colors"
        >
          {theme === "dark" ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
          <span className="hidden lg:block text-xs font-medium">
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </span>
        </button>
      </div>
    </aside>
  );
}
