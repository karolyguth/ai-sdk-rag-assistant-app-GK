import { Chat } from '@/components/chat';
import { DocumentUpload } from '@/components/document-upload';

export default function Home() {
  return (
    <>
      <div className="mx-auto w-full max-w-2xl px-4 pt-8">
        <DocumentUpload />
      </div>
      <Chat />
    </>
  );
}
