import { Sidebar } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";
import { StatusBar } from "@/components/shell/StatusBar";

type ShellProps = {
  children: React.ReactNode;
};

export function Shell({ children }: ShellProps) {
  return (
    <div className="min-h-screen bg-hive-bg text-hive-text">
      <Sidebar />
      <div className="pl-[240px] flex flex-col min-h-screen">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
        <StatusBar />
      </div>
    </div>
  );
}
