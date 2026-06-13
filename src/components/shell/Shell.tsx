import { Sidebar } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";
import { StatusBar } from "@/components/shell/StatusBar";

type ShellProps = {
  children: React.ReactNode;
};

export function Shell({ children }: ShellProps) {
  return (
    <div className="relative isolate min-h-screen bg-background text-foreground">
      {/* Atmósfera: aurora ámbar + grano de ruido, fija detrás de todo */}
      <div
        aria-hidden="true"
        className="noise pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="shell-aurora" />
      </div>

      <Sidebar />

      <div className="flex min-h-screen flex-col pl-[240px]">
        <TopBar />
        <main className="flex-1 p-6">{children}</main>
        <StatusBar />
      </div>
    </div>
  );
}
