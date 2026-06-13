import { Container } from "@/components/ui/container";
import { DocSidebar } from "@/components/docs/doc-sidebar";

export default function DocsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Container className="pt-32 pb-24 md:pt-36">
      <div className="grid gap-12 lg:grid-cols-[15rem_1fr] lg:gap-16">
        <aside className="lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)] lg:self-start lg:overflow-y-auto">
          <DocSidebar />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </Container>
  );
}
