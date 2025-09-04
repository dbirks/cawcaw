'use client';

import { cn } from '@/lib/utils';

interface BouncingDotsProps {
  className?: string;
}

export const BouncingDots = ({ className }: BouncingDotsProps) => {
  return (
    <div className={cn('flex items-center space-x-1', className)}>
      <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.3s]" />
      <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.15s]" />
      <div className="w-2 h-2 bg-current rounded-full animate-bounce" />
    </div>
  );
};

interface LoadingMessageProps {
  className?: string;
}

export const LoadingMessage = ({ className }: LoadingMessageProps) => {
  return (
    <div className={cn('flex items-center text-muted-foreground', className)}>
      <BouncingDots />
    </div>
  );
};
