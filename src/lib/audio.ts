export function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function formatTimeFromSec(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function finiteDuration(
  mediaSeconds: number,
  fallbackMs = 0
): number {
  if (Number.isFinite(mediaSeconds) && mediaSeconds > 0) return mediaSeconds;
  const fallback = fallbackMs / 1000;
  if (Number.isFinite(fallback) && fallback > 0) return fallback;
  return 0;
}

export function readAudioDurationMs(file: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = "metadata";
    const done = (ms: number) => {
      URL.revokeObjectURL(url);
      resolve(ms);
    };
    audio.onloadedmetadata = () => {
      const d = audio.duration;
      done(Number.isFinite(d) && d > 0 ? d * 1000 : 0);
    };
    audio.onerror = () => done(0);
    audio.src = url;
  });
}

export function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function getWaveformData(
  analyser: AnalyserNode,
  dataArray: Uint8Array
): number[] {
  analyser.getByteTimeDomainData(dataArray as Uint8Array<ArrayBuffer>);
  const bars = 40;
  const step = Math.floor(dataArray.length / bars);
  const result: number[] = [];
  for (let i = 0; i < bars; i++) {
    let sum = 0;
    for (let j = 0; j < step; j++) {
      sum += Math.abs(dataArray[i * step + j] - 128);
    }
    result.push(sum / step / 128);
  }
  return result;
}

export async function decodeAudioForWaveform(
  audioData: ArrayBuffer
): Promise<number[]> {
  try {
    const ctx = new AudioContext();
    const buffer = await ctx.decodeAudioData(audioData);
    const channelData = buffer.getChannelData(0);
    const bars = 80;
    const step = Math.floor(channelData.length / bars);
    const result: number[] = [];
    for (let i = 0; i < bars; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) {
        sum += Math.abs(channelData[i * step + j]);
      }
      result.push(sum / step);
    }
    const max = Math.max(...result, 0.01);
    return result.map((v) => v / max);
  } catch {
    return Array(80).fill(0.2);
  }
}
