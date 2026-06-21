import { Loader2 } from 'lucide-react';

interface SectionLoaderProps {
  message: string;
}

export function SectionLoader({ message }: SectionLoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
      <Loader2 className="mb-3 h-8 w-8 animate-spin text-orange-500" />
      <p>{message}</p>
    </div>
  );
}
