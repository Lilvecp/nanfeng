import { PageTransition } from "@/components/page-transition";
import { Sidebar } from "@/components/sidebar";

export default function DeskLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
