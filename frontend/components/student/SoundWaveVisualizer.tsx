import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

const BAR_COUNT = 24;
const MIN_HEIGHT = 4;
const MAX_HEIGHT = 32;

/** Decorative playback wave: smooth animated bars when AI is speaking */
function PlaybackWave() {
  const [heights, setHeights] = useState(() => Array(BAR_COUNT).fill(MIN_HEIGHT));
  const phaseRef = useRef(0);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      phaseRef.current += 0.08;
      setHeights((prev) =>
        prev.map((_, i) => {
          const t = phaseRef.current + (i * Math.PI) / BAR_COUNT;
          const wave = Math.sin(t) * 0.5 + Math.sin(t * 2.3 + 1) * 0.3 + 0.5;
          return Math.round(MIN_HEIGHT + wave * (MAX_HEIGHT - MIN_HEIGHT));
        })
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="flex items-end justify-center gap-0.5 h-10" aria-hidden>
      {heights.map((h, i) => (
        <motion.div
          key={i}
          className="w-1 rounded-full bg-sage/70 min-h-[4px]"
          animate={{ height: h }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          style={{ height: h }}
        />
      ))}
    </div>
  );
}

interface LiveWaveProps {
  analyserRef: React.RefObject<AnalyserNode | null>;
  isActive: boolean;
}

/** Live waveform from microphone AnalyserNode */
function LiveWave({ analyserRef, isActive }: LiveWaveProps) {
  const [heights, setHeights] = useState(() => Array(BAR_COUNT).fill(MIN_HEIGHT));
  const dataArray = useRef<Uint8Array | null>(null);
  const bufferLengthRef = useRef(0);

  useEffect(() => {
    if (!isActive || !analyserRef?.current) return;
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    bufferLengthRef.current = bufferLength;
    dataArray.current = new Uint8Array(bufferLength);

    let raf = 0;
    const tick = () => {
      if (!dataArray.current) return;
      analyser.getByteFrequencyData(dataArray.current);
      const data = dataArray.current;
      const step = Math.floor(bufferLength / BAR_COUNT);
      const next = Array(BAR_COUNT)
        .fill(0)
        .map((_, i) => {
          const start = i * step;
          let sum = 0;
          for (let j = 0; j < step && start + j < data.length; j++) sum += data[start + j];
          const avg = step > 0 ? sum / step : 0;
          const normalized = Math.min(255, avg * 1.2);
          return Math.round(MIN_HEIGHT + (normalized / 255) * (MAX_HEIGHT - MIN_HEIGHT));
        });
      setHeights(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isActive, analyserRef]);

  return (
    <div className="flex items-end justify-center gap-0.5 h-10" aria-hidden>
      {heights.map((h, i) => (
        <motion.div
          key={i}
          className="w-1 rounded-full bg-sage min-h-[4px]"
          animate={{ height: h }}
          transition={{ duration: 0.05 }}
          style={{ height: h }}
        />
      ))}
    </div>
  );
}

export interface SoundWaveVisualizerProps {
  mode: 'live' | 'playback';
  analyserRef?: React.RefObject<AnalyserNode | null>;
  isActive: boolean;
  className?: string;
}

/** Creative sound wave: live mic input or decorative playback animation */
export function SoundWaveVisualizer({ mode, analyserRef, isActive, className = '' }: SoundWaveVisualizerProps) {
  if (!isActive) {
    return (
      <div className={`flex items-end justify-center gap-0.5 h-10 ${className}`}>
        {Array(BAR_COUNT)
          .fill(0)
          .map((_, i) => (
            <div
              key={i}
              className="w-1 rounded-full bg-gray-200 min-h-[4px] h-2"
              style={{ height: MIN_HEIGHT }}
            />
          ))}
      </div>
    );
  }

  return (
    <div className={className}>
      {mode === 'live' && analyserRef ? (
        <LiveWave analyserRef={analyserRef} isActive={isActive} />
      ) : (
        <PlaybackWave />
      )}
    </div>
  );
}
