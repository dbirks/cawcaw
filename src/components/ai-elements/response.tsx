'use client';

import { type ComponentProps, memo } from 'react';
import { Streamdown } from 'streamdown';
import { cn } from '@/lib/utils';

type ResponseProps = ComponentProps<typeof Streamdown>;

export const Response = memo(
  ({ className, ...props }: ResponseProps) => (
    <Streamdown
      className={cn(
        'size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
        // Table wrapper: overflow-x-auto allows horizontal scroll within message bubble
        // max-w-full prevents table from expanding parent containers
        '[&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto',
        // Table styling: w-full for proper layout, but contained by max-w-full
        '[&_table_table]:w-full',
        className
      )}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

Response.displayName = 'Response';
