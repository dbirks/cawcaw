/**
 * Local AI Progress Card
 *
 * Displays detailed download progress for local AI model.
 * Shows progress bar, current stage, download speed, and estimated time.
 *
 * Progress smoothing: Optionally interpolates between progress values for
 * smooth visual transitions. Disabled by default since worker now handles
 * aggregation and debouncing.
 */

import { Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface LocalAIProgressCardProps {
  progress: number; // 0-1
  stage: string;
  downloadSpeed?: string; // e.g., "2.5 MB/s"
  estimatedTimeRemaining?: string; // e.g., "30s"
  enableSmoothing?: boolean; // Optional: smooth progress transitions (default: false)
}

export function LocalAIProgressCard({
  progress,
  stage,
  downloadSpeed,
  estimatedTimeRemaining,
  enableSmoothing = false,
}: LocalAIProgressCardProps) {
  // Optional smoothing state (disabled by default)
  const [displayProgress, setDisplayProgress] = useState(progress);
  const animationFrameRef = useRef<number | null>(null);

  // Smooth progress transitions if enabled
  useEffect(() => {
    if (!enableSmoothing) {
      setDisplayProgress(progress);
      return;
    }

    // Smoothly interpolate to target progress
    const animate = () => {
      setDisplayProgress((current) => {
        const diff = progress - current;

        // Close enough - snap to target
        if (Math.abs(diff) < 0.001) {
          return progress;
        }

        // Smoothly move towards target (20% per frame)
        return current + diff * 0.2;
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [progress, enableSmoothing]);

  // Use smoothed or direct progress based on setting
  const effectiveProgress = enableSmoothing ? displayProgress : progress;

  // Ensure progress is always valid (0-100%)
  // Clamp to 0-1 range first, then convert to percentage
  const clampedProgress = Math.max(0, Math.min(1, effectiveProgress));
  const progressPercent = Math.round(clampedProgress * 100);

  return (
    <Card className="border-2 border-primary/20 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Loader2 className="h-4 w-4 animate-spin" />
          Downloading Local AI Model
        </CardTitle>
        <CardDescription>
          First-time download (~150-250MB). Model will be cached for offline use after download
          completes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground capitalize">{stage}</span>
            <span className="font-medium">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Download Stats */}
        {(downloadSpeed || estimatedTimeRemaining) && (
          <div className="flex justify-between text-xs text-muted-foreground">
            {downloadSpeed && <span>{downloadSpeed}</span>}
            {estimatedTimeRemaining && <span>~{estimatedTimeRemaining} remaining</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
