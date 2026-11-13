import { Chat } from '@/components/chat';
import { DocumentList } from '@/components/document-list';
import { DocumentUpload } from '@/components/document-upload';

export default function Home() {
  return (
    <>
      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pt-8">
        <DocumentUpload />
        <DocumentList />
      </div>
      <Chat />
    </>
  );
}
