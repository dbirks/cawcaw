'use client';

import type { ChatStatus } from 'ai';
import { ArrowUpIcon, Loader2Icon, SquareIcon, XIcon } from 'lucide-react';
import type { ComponentProps, HTMLAttributes, KeyboardEventHandler } from 'react';
import { Children } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export type PromptInputProps = HTMLAttributes<HTMLFormElement>;

export const PromptInput = ({ className, ...props }: PromptInputProps) => (
  <form
    className={cn(
      'w-full divide-y overflow-hidden rounded-xl border bg-background shadow-sm',
      className
    )}
    {...props}
  />
);

export type PromptInputTextareaProps = ComponentProps<typeof Textarea> & {
  minHeight?: number;
  maxHeight?: number;
};

export const PromptInputTextarea = ({
  onChange,
  className,
  placeholder = 'What would you like to know?',
  minHeight = 48,
  maxHeight = 164,
  ...props
}: PromptInputTextareaProps) => {
  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === 'Enter') {
      // Don't submit if IME composition is in progress
      if (e.nativeEvent.isComposing) {
        return;
      }

      if (e.shiftKey) {
        // Allow newline
        return;
      }

      // Submit on Enter (without Shift)
      e.preventDefault();
      const form = e.currentTarget.form;
      if (form) {
        form.requestSubmit();
      }
    }
  };

  return (
    <Textarea
      className={cn(
        'w-full resize-none rounded-none border-none p-3 shadow-none outline-none ring-0',
        'field-sizing-content max-h-[6lh] bg-transparent dark:bg-transparent',
        'focus-visible:ring-0',
        className
      )}
      name="message"
      onChange={(e) => {
        onChange?.(e);
      }}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      {...props}
    />
  );
};

export type PromptInputToolbarProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputToolbar = ({ className, ...props }: PromptInputToolbarProps) => (
  <div className={cn('flex items-center justify-between p-1', className)} {...props} />
);

export type PromptInputToolsProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputTools = ({ className, ...props }: PromptInputToolsProps) => (
  <div
    className={cn('flex items-center gap-1', '[&_button:first-child]:rounded-bl-xl', className)}
    {...props}
  />
);

export type PromptInputButtonProps = ComponentProps<typeof Button>;

export const PromptInputButton = ({
  variant = 'ghost',
  className,
  size,
  children,
  ...props
}: PromptInputButtonProps) => {
  const childCount = Children.count(children);
  const hasTextContent = childCount > 1;
  const newSize = size ?? (hasTextContent ? 'sm' : 'icon');

  return (
    <Button
      className={cn(
        'shrink-0 gap-1.5 rounded-lg transition-colors',
        variant === 'ghost' && 'text-muted-foreground hover:text-foreground',
        newSize === 'sm' && 'h-9 px-3',
        newSize === 'icon' && 'h-9 w-9',
        className
      )}
      size={newSize}
      type="button"
      variant={variant}
      {...props}
    >
      {children}
    </Button>
  );
};

export type PromptInputSubmitProps = ComponentProps<typeof Button> & {
  status?: ChatStatus;
};

export const PromptInputSubmit = ({
  className,
  variant = 'default',
  size = 'icon',
  status,
  children,
  ...props
}: PromptInputSubmitProps) => {
  let Icon = <ArrowUpIcon className="size-4" />;

  if (status === 'submitted') {
    Icon = <Loader2Icon className="size-4 animate-spin" />;
  } else if (status === 'streaming') {
    Icon = <SquareIcon className="size-4" />;
  } else if (status === 'error') {
    Icon = <XIcon className="size-4" />;
  }

  return (
    <Button
      className={cn('gap-1.5 rounded-full', className)}
      size={size}
      type="submit"
      variant={variant}
      {...props}
    >
      {children ?? Icon}
    </Button>
  );
};

export type PromptInputModelSelectProps = ComponentProps<typeof Select>;

export const PromptInputModelSelect = (props: PromptInputModelSelectProps) => <Select {...props} />;

export type PromptInputModelSelectTriggerProps = ComponentProps<typeof SelectTrigger>;

export const PromptInputModelSelectTrigger = ({
  className,
  ...props
}: PromptInputModelSelectTriggerProps) => (
  <SelectTrigger
    className={cn(
      'border-none bg-background font-medium text-muted-foreground shadow-none transition-colors',
      'hover:bg-background hover:text-foreground [&[aria-expanded="true"]]:bg-background [&[aria-expanded="true"]]:text-foreground',
      className
    )}
    {...props}
  />
);

export type PromptInputModelSelectContentProps = ComponentProps<typeof SelectContent>;

export const PromptInputModelSelectContent = ({
  className,
  ...props
}: PromptInputModelSelectContentProps) => <SelectContent className={cn(className)} {...props} />;

export type PromptInputModelSelectItemProps = ComponentProps<typeof SelectItem>;

export const PromptInputModelSelectItem = ({
  className,
  ...props
}: PromptInputModelSelectItemProps) => <SelectItem className={cn(className)} {...props} />;

export type PromptInputModelSelectValueProps = ComponentProps<typeof SelectValue>;

export const PromptInputModelSelectValue = ({
  className,
  ...props
}: PromptInputModelSelectValueProps) => <SelectValue className={cn(className)} {...props} />;

// MCP Server Select Components
export type PromptInputMcpSelectProps = ComponentProps<typeof Select>;

export const PromptInputMcpSelect = (props: PromptInputMcpSelectProps) => <Select {...props} />;

export type PromptInputMcpSelectTriggerProps = ComponentProps<typeof SelectTrigger>;

export const PromptInputMcpSelectTrigger = ({
  className,
  ...props
}: PromptInputMcpSelectTriggerProps) => (
  <SelectTrigger
    className={cn(
      'border-none bg-transparent font-medium text-muted-foreground shadow-none transition-colors',
      'hover:bg-accent hover:text-foreground [&[aria-expanded="true"]]:bg-accent [&[aria-expanded="true"]]:text-foreground',
      className
    )}
    {...props}
  />
);

export type PromptInputMcpSelectContentProps = ComponentProps<typeof SelectContent>;

export const PromptInputMcpSelectContent = ({
  className,
  ...props
}: PromptInputMcpSelectContentProps) => <SelectContent className={cn(className)} {...props} />;

export type PromptInputMcpSelectItemProps = ComponentProps<typeof SelectItem>;

export const PromptInputMcpSelectItem = ({
  className,
  ...props
}: PromptInputMcpSelectItemProps) => <SelectItem className={cn(className)} {...props} />;

export type PromptInputMcpSelectValueProps = ComponentProps<typeof SelectValue>;

export const PromptInputMcpSelectValue = ({
  className,
  ...props
}: PromptInputMcpSelectValueProps) => <SelectValue className={cn(className)} {...props} />;
