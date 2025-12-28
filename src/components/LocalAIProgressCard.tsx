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

import { AlertCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface LocalAIProgressCardProps {
  progress: number; // 0-1
  stage: string;
  downloadSpeed?: string; // e.g., "2.5 MB/s"
  estimatedTimeRemaining?: string; // e.g., "30s"
  modelName?: string; // e.g., "google/gemma-3-270m"
  modelSize?: string; // e.g., "220 MB"
  enableSmoothing?: boolean; // Optional: smooth progress transitions (default: false)
  error?: {
    message: string;
    details?: string;
    stage?: string; // What failed: "download", "cache", "model-load"
  };
  onRetry?: () => void;
}

export function LocalAIProgressCard({
  progress,
  stage,
  downloadSpeed,
  estimatedTimeRemaining,
  modelName,
  modelSize,
  enableSmoothing = false,
  error,
  onRetry,
}: LocalAIProgressCardProps) {
  // Optional smoothing state (disabled by default)
  const [displayProgress, setDisplayProgress] = useState(progress);
  const animationFrameRef = useRef<number | null>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

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

  // If error is present, show error state
  if (error) {
    return (
      <Card className="border-2 border-destructive/50 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <AlertCircle className="h-4 w-4" />
            Download Failed
          </CardTitle>
          <CardDescription>
            {error.stage && `Failed during ${error.stage}. `}
            {error.message}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Error Message */}
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <p className="font-medium mb-1">What went wrong:</p>
            <p>{error.message}</p>
          </div>

          {/* Actionable Steps */}
          <div className="rounded-md bg-muted p-3 text-sm">
            <p className="font-medium mb-2">Try these steps:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Check your internet connection</li>
              <li>Make sure you have enough storage space (~250 MB)</li>
              {error.stage === 'download' && <li>Try downloading again in a few minutes</li>}
              {error.stage === 'cache' && <li>Clear browser cache and retry</li>}
              {error.stage === 'model-load' && (
                <li>Your device may not support WebGPU - try OpenAI/Anthropic instead</li>
              )}
              <li>If the problem persists, use OpenAI or Anthropic models instead</li>
            </ul>
          </div>

          {/* Technical Details (Collapsible) */}
          {error.details && (
            <div className="space-y-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                className="w-full justify-between h-8"
              >
                <span className="text-xs font-medium">Technical Details</span>
                {showTechnicalDetails ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </Button>
              {showTechnicalDetails && (
                <div className="rounded-md bg-muted p-3 text-xs font-mono text-muted-foreground overflow-x-auto">
                  {error.details}
                </div>
              )}
            </div>
          )}

          {/* Retry Button */}
          {onRetry && (
            <Button onClick={onRetry} className="w-full" variant="default">
              Retry Download
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Normal progress state
  return (
    <Card className="border-2 border-primary/20 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Loader2 className="h-4 w-4 animate-spin" />
          Downloading Local AI Model
        </CardTitle>
        <CardDescription>
          {modelName && modelSize ? (
            <>
              {modelName} ({modelSize})
            </>
          ) : (
            <>
              First-time download (~430 MB). Model will be cached for offline use after download
              completes.
            </>
          )}
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
