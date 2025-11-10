import { useEffect, useRef } from 'react';

interface LiveAudioVisualizerProps {
  mediaRecorder: MediaRecorder;
  width?: number;
  height?: number;
  barColor?: string;
  gap?: number;
  barWidth?: number;
}

export function LiveAudioVisualizer({
  mediaRecorder,
  width = 120,
  height = 32,
  barColor = 'rgb(239 68 68)', // red-500
  gap = 2,
  barWidth = 3,
}: LiveAudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode>();
  const dataArrayRef = useRef<Uint8Array>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get the stream from the MediaRecorder
    const stream = mediaRecorder.stream;

    // Create audio context and analyser
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();

    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    source.connect(analyser);

    analyserRef.current = analyser;
    dataArrayRef.current = dataArray;

    // Calculate number of bars
    const barCount = Math.floor(width / (barWidth + gap));

    // Animation function
    const draw = () => {
      if (!analyserRef.current || !dataArrayRef.current || !ctx) return;

      analyserRef.current.getByteFrequencyData(dataArrayRef.current);

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Draw bars
      for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor((i * bufferLength) / barCount);
        const barHeight = (dataArrayRef.current[dataIndex] / 255) * height;

        const x = i * (barWidth + gap);
        const y = height - barHeight;

        ctx.fillStyle = barColor;
        ctx.fillRect(x, y, barWidth, barHeight);
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    // Cleanup
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      audioContext.close();
    };
  }, [mediaRecorder, width, height, barColor, gap, barWidth]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="rounded"
    />
  );
}
