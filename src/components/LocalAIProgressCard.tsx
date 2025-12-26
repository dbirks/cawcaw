/**
 * Local AI Progress Card
 *
 * Displays detailed download progress for local AI model.
 * Shows progress bar, current stage, download speed, and estimated time.
 */

import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface LocalAIProgressCardProps {
  progress: number; // 0-1
  stage: string;
  downloadSpeed?: string; // e.g., "2.5 MB/s"
  estimatedTimeRemaining?: string; // e.g., "30s"
}

export function LocalAIProgressCard({
  progress,
  stage,
  downloadSpeed,
  estimatedTimeRemaining,
}: LocalAIProgressCardProps) {
  const progressPercent = Math.round(progress * 100);

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
