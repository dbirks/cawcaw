'use client';

import type { ToolUIPart } from 'ai';
import {
  CheckCircleIcon,
  ChevronDownIcon,
  CircleIcon,
  ClockIcon,
  WrenchIcon,
  XCircleIcon,
} from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { CodeBlock } from './code-block';

export type ToolProps = ComponentProps<typeof Collapsible>;

export const Tool = ({ className, ...props }: ToolProps) => (
  <Collapsible
    className={cn(
      'not-prose mb-4',
      'bg-emerald-900 dark:bg-emerald-950 text-white',
      // Full width within parent container - no overflow
      'w-full',
      className
    )}
    {...props}
  />
);

export type ToolHeaderProps = {
  type: ToolUIPart['type'];
  state: ToolUIPart['state'];
  className?: string;
};

const getStatusBadge = (status: ToolUIPart['state']) => {
  const labels = {
    'input-streaming': 'Pending',
    'input-available': 'Running',
    'approval-requested': 'Approval Required',
    'approval-responded': 'Approved',
    'output-available': 'Completed',
    'output-error': 'Error',
    'output-denied': 'Denied',
  } as const;

  const icons = {
    'input-streaming': <CircleIcon className="size-4" />,
    'input-available': <ClockIcon className="size-4 animate-pulse" />,
    'approval-requested': <ClockIcon className="size-4 text-yellow-600" />,
    'approval-responded': <CheckCircleIcon className="size-4 text-blue-600" />,
    'output-available': <CheckCircleIcon className="size-4 text-emerald-600" />,
    'output-error': <XCircleIcon className="size-4 text-red-600" />,
    'output-denied': <XCircleIcon className="size-4 text-orange-600" />,
  } as const;

  return (
    <Badge className="rounded-full text-xs" variant="secondary">
      {icons[status]}
      {labels[status]}
    </Badge>
  );
};

export const ToolHeader = ({ className, type, state, ...props }: ToolHeaderProps) => {
  // Extract the full tool name from the type
  // Format: "tool-Server_Name_GetCurrentDate" -> Display full name after "tool-" prefix
  const extractToolName = (type: string) => {
    if (!type.startsWith('tool-')) {
      return type;
    }

    // Remove "tool-" prefix and show everything after it as the tool name
    const fullName = type.slice(5);

    // If there are underscores, assume format is "ServerName_ToolName"
    // and extract just the tool name part (after last underscore)
    const lastUnderscoreIndex = fullName.lastIndexOf('_');

    if (lastUnderscoreIndex === -1) {
      // No underscore found, return entire name
      return fullName;
    }

    // Return the part after the last underscore (the actual tool name)
    return fullName.slice(lastUnderscoreIndex + 1);
  };

  const toolName = extractToolName(type);

  return (
    <CollapsibleTrigger
      className={cn('flex w-full items-center justify-between gap-4 p-3 text-white', className)}
      {...props}
    >
      <div className="flex items-center gap-2">
        <WrenchIcon className="size-4 text-white/80" />
        <span className="font-medium text-sm">{toolName}</span>
        {getStatusBadge(state)}
      </div>
      <ChevronDownIcon className="size-4 text-white/80 transition-transform group-data-[state=open]:rotate-180" />
    </CollapsibleTrigger>
  );
};

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>;

export const ToolContent = ({ className, ...props }: ToolContentProps) => (
  <CollapsibleContent
    className={cn(
      'data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in',
      className
    )}
    {...props}
  />
);

export type ToolInputProps = ComponentProps<'div'> & {
  input: ToolUIPart['input'];
  toolType?: string;
};

export const ToolInput = ({ className, input, toolType, ...props }: ToolInputProps) => {
  // Extract server name from tool type for display
  const extractServerName = (type?: string) => {
    if (!type || !type.startsWith('tool-')) {
      return null;
    }

    const withoutPrefix = type.slice(5); // Remove "tool-" prefix
    const lastUnderscoreIndex = withoutPrefix.lastIndexOf('_');

    if (lastUnderscoreIndex === -1) {
      return null;
    }

    return withoutPrefix.slice(0, lastUnderscoreIndex).replace(/_/g, ' ');
  };

  const serverName = extractServerName(toolType);

  return (
    <div className={cn('space-y-2 overflow-hidden p-4', className)} {...props}>
      {serverName && (
        <div className="mb-2">
          <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-1">
            MCP Server
          </h4>
          <span className="text-sm font-medium">{serverName}</span>
        </div>
      )}
      <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        Parameters
      </h4>
      <div className="rounded-md bg-muted/50">
        <CodeBlock code={JSON.stringify(input, null, 2)} language="json" />
      </div>
    </div>
  );
};

export type ToolOutputProps = ComponentProps<'div'> & {
  output: ReactNode | Record<string, unknown> | unknown;
  errorText: ToolUIPart['errorText'];
};

export const ToolOutput = ({ className, output, errorText, ...props }: ToolOutputProps) => {
  if (!(output || errorText)) {
    return null;
  }

  // Helper to check if value is a React element
  const isReactElement = (value: unknown): value is ReactNode => {
    return (
      value !== null &&
      typeof value === 'object' &&
      '$$typeof' in value &&
      value.$$typeof === Symbol.for('react.element')
    );
  };

  // Detect if output is a JSON object/array and should be rendered with syntax highlighting
  const isJsonOutput = typeof output === 'object' && output !== null && !isReactElement(output);

  const renderOutput = () => {
    if (isJsonOutput) {
      // Render JSON with syntax highlighting
      const jsonString = JSON.stringify(output, null, 2);
      return <CodeBlock code={jsonString} language="json" />;
    }

    // For string outputs, check if it's JSON string
    if (typeof output === 'string') {
      try {
        const parsed = JSON.parse(output);
        // If it parses successfully and is an object/array, render with syntax highlighting
        if (typeof parsed === 'object' && parsed !== null) {
          return <CodeBlock code={JSON.stringify(parsed, null, 2)} language="json" />;
        }
      } catch {
        // Not valid JSON, render as-is
      }
      return <div className="whitespace-pre-wrap font-mono text-xs p-3">{output}</div>;
    }

    // For ReactNode or other types, render directly
    return <div>{String(output)}</div>;
  };

  return (
    <div className={cn('space-y-2 p-4', className)} {...props}>
      <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {errorText ? 'Error' : 'Result'}
      </h4>
      <div
        className={cn(
          'overflow-x-auto rounded-md',
          errorText && 'bg-destructive/10 text-destructive'
        )}
      >
        {errorText && <div className="p-3 text-xs">{errorText}</div>}
        {output !== null && output !== undefined && renderOutput()}
      </div>
    </div>
  );
};
