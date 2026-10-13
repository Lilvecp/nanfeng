import { DeskGate } from "@/components/desk-gate";
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
        <PageTransition><DeskGate>{children}</DeskGate></PageTransition>
      </main>
      <Guide />
      <Director />
      <OwnerLogin />
    </div>
  );
}
