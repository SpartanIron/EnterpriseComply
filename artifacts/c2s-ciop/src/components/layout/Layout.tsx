import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-16 lg:ml-56 min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto" style={{ backgroundColor: "#f1f5f9" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
