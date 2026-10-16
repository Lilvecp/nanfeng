import { ApiGate } from "@/components/api-gate";
import { Director } from "@/components/director";
import { Guide } from "@/components/guide";
import { OwnerLogin } from "@/components/owner-login";
import { PageTransition } from "@/components/page-transition";
import { Sidebar } from "@/components/sidebar";

export default function DeskLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <ApiGate>
          <PageTransition>{children}</PageTransition>
        </ApiGate>
      </main>
      <Guide />
      <Director />
      <OwnerLogin />
    </div>
  );
}
