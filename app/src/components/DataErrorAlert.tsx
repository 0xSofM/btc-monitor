import { AlertTriangle } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface DataErrorAlertProps {
  message: string | null;
}

export function DataErrorAlert({ message }: DataErrorAlertProps) {
  if (!message) {
    return null;
  }

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>数据获取失败</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
