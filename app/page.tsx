import { Chat } from '@/components/chat';
import { DocumentList } from '@/components/document-list';
import { DocumentUpload } from '@/components/document-upload';

// Telefonon a chat van felül, asztali nézetben két oszlop
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 p-4 md:h-screen md:flex-row md:overflow-hidden">
      <section className="order-1 flex min-h-[85vh] flex-1 flex-col md:order-2 md:min-h-0">
        <Chat />
      </section>
      <aside className="order-2 space-y-4 md:order-1 md:w-80 md:shrink-0 md:overflow-y-auto lg:w-96">
        <DocumentUpload />
        <DocumentList />
      </aside>
    </main>
  );
}
