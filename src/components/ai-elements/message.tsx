import type { UIMessage } from 'ai';
import type { ComponentProps, HTMLAttributes } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage['role'];
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      'group flex w-full items-end justify-end gap-2 py-4',
      from === 'user' ? 'is-user' : 'is-assistant flex-row-reverse justify-end',
      // User messages: constrained width for bubble effect
      'group-[.is-user]:[&>div]:max-w-[min(80%,42rem)]',
      // Assistant messages: full width for flat interface
      'group-[.is-assistant]:[&>div]:max-w-full',
      className
    )}
    {...props}
  />
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({ children, className, ...props }: MessageContentProps) => (
  <div
    className={cn(
      'flex flex-col gap-2 overflow-x-hidden text-foreground text-sm',
      'min-w-0', // Prevent flex child from expanding beyond parent
      // User messages: keep bubble styling with background
      'group-[.is-user]:rounded-lg group-[.is-user]:px-4 group-[.is-user]:py-3',
      'group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground',
      // Assistant messages: full-width, flat interface with small horizontal padding
      'group-[.is-assistant]:bg-transparent group-[.is-assistant]:text-foreground',
      'group-[.is-assistant]:px-4',
      className
    )}
    {...props}
  >
    <div className="is-user:dark w-full max-w-full min-w-0">{children}</div>
  </div>
);

export type MessageAvatarProps = ComponentProps<typeof Avatar> & {
  src: string;
  name?: string;
};

export const MessageAvatar = ({ src, name, className, ...props }: MessageAvatarProps) => (
  <Avatar className={cn('size-8 ring ring-1 ring-border', className)} {...props}>
    <AvatarImage alt="" className="mt-0 mb-0" src={src} />
    <AvatarFallback>{name?.slice(0, 2) || 'ME'}</AvatarFallback>
  </Avatar>
);
