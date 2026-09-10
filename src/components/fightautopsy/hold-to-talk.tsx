"use client";

// HoldToTalk — voice capture instrument for the intake screens.
//
// Voice Intake spec (amendment §3-5):
//   - Press-and-hold to record; release to stop. Transcript lands in textarea.
//   - 90-second maximum per recording, enforced client-side.
//   - One recording + one re-record per prompt. After take 2, mic is dead.
//   - Live waveform via getUserMedia + AnalyserNode (real, not faked).
//   - Web Speech API for transcript; webkitSpeechRecognition fallback.
//   - Feature-detected: mic hidden where unsupported, typing always works.
//   - No audio persistence: raw recording discarded on release; only the
//     transcript string enters the room document.
//   - No audio output ever (invariant 1). This component produces no sound.
//
// Design principle from the spec: "voice is a capture instrument, not a
// companion." The draining progress bar + waveform read as a recording device,
// not a listening entity.

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** Current textarea value — so we can append/replace the transcript. */
  currentValue: string;
  /** Called with the new text when a transcript is captured. */
  onTranscript: (text: string) => void;
  /** Disabled state (e.g., when take limit reached). */
  disabled?: boolean;
}

type MicState =
  | { kind: "idle" }
  | { kind: "recording"; startedAt: number }
  | { kind: "processing" }
  | { kind: "error"; message: string }
  | { kind: "unsupported" };

const MAX_DURATION_MS = 90_000; // 90s spec §4
const SILENCE_TIMEOUT_MS = 5_000; // 5s of silence → stop (spec §6)

// Feature-detect Web Speech API. This runs once.
function getSpeechRecognition():
  | (typeof window & {
      SpeechRecognition?: new () => any;
      webkitSpeechRecognition?: new () => any;
    })
  | null {
  if (typeof window === "undefined") return null;
  const w = window as typeof window & {
    SpeechRecognition?: new () => any;
    webkitSpeechRecognition?: new () => any;
  };
  if (w.SpeechRecognition || w.webkitSpeechRecognition) return w;
  return null;
}

export function HoldToTalk({ currentValue, onTranscript, disabled }: Props) {
  // Feature-detect Web Speech API at initialization (lazy initial state).
  const [state, setState] = useState<MicState>(() => {
    if (typeof window === "undefined") return { kind: "idle" };
    const w = window as typeof window & {
      SpeechRecognition?: new () => any;
      webkitSpeechRecognition?: new () => any;
    };
    if (!w.SpeechRecognition && !w.webkitSpeechRecognition) {
      return { kind: "unsupported" };
    }
    return { kind: "idle" };
  });
  const [takeCount, setTakeCount] = useState(0); // 0, 1, or 2
  const [progress, setProgress] = useState(0); // 0-1 for the draining bar
  const [waveform, setWaveform] = useState<number[]>(new Array(24).fill(0));

  const recognitionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const transcriptRef = useRef<string>("");
  const startTimeRef = useRef<number>(0);
  // Ref to hold the latest handleStop so the silence timer (set inside
  // handleStart) can call it without a forward-declaration ordering issue.
  const handleStopRef = useRef<() => void>(() => {});
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAll = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {
        // ignore
      }
      audioContextRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopAll();
  }, [stopAll]);

  const startWaveform = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AC();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const bars = 24;

      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        // Downsample to `bars` buckets
        const next: number[] = [];
        const bucketSize = Math.floor(dataArray.length / bars);
        for (let i = 0; i < bars; i++) {
          let sum = 0;
          for (let j = 0; j < bucketSize; j++) {
            sum += dataArray[i * bucketSize + j] ?? 0;
          }
          next.push(sum / bucketSize / 255); // 0-1
        }
        setWaveform(next);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // getUserMedia denied — we can still run SpeechRecognition without
      // the waveform. The progress bar still drains.
      setWaveform(new Array(24).fill(0));
    }
  }, []);

  const handleStart = useCallback(async () => {
    if (disabled || takeCount >= 2) return;
    const srWindow = getSpeechRecognition();
    if (!srWindow) {
      setState({ kind: "unsupported" });
      return;
    }

    const SR = srWindow.SpeechRecognition || srWindow.webkitSpeechRecognition;
    if (!SR) {
      setState({ kind: "unsupported" });
      return;
    }

    transcriptRef.current = "";
    setState({ kind: "recording", startedAt: Date.now() });
    startTimeRef.current = Date.now();
    setProgress(0);

    // Start waveform (best-effort; falls back to no-op on denial)
    startWaveform();

    // Start SpeechRecognition
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let final = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (final) transcriptRef.current += final;
      // Reset silence timer on any speech
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        // 5s of silence → stop (spec §6)
        handleStopRef.current();
      }, SILENCE_TIMEOUT_MS);
    };

    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setState({
          kind: "error",
          message: "Microphone permission was denied. You can still type — typing always works.",
        });
        stopAll();
      } else if (event.error === "no-speech") {
        // Expected if user releases with silence — handled in handleStop
      } else {
        setState({
          kind: "error",
          message: `Recognition error: ${event.error}. You can still type.`,
        });
      }
    };

    recognition.onend = () => {
      // Recognition ended (either we stopped it, or it timed out)
      // Don't restart automatically — we're done.
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      setState({
        kind: "error",
        message: "Could not start recognition. You can still type.",
      });
      stopAll();
      return;
    }

    // Draining progress bar
    progressTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const p = Math.min(elapsed / MAX_DURATION_MS, 1);
      setProgress(p);
      if (p >= 1) {
        // 90s max — auto-stop
        handleStopRef.current();
      }
    }, 100);
  }, [disabled, takeCount, startWaveform, stopAll]);

  const handleStop = useCallback(() => {
    if (state.kind !== "recording") return;

    // Capture the transcript before cleanup
    const transcript = transcriptRef.current.trim();

    // Stop everything
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {
        // ignore
      }
      audioContextRef.current = null;
    }

    setWaveform(new Array(24).fill(0));
    setProgress(0);

    // Spec §6: "empty transcript doesn't overwrite existing text"
    if (transcript) {
      // Spec: take 2 replaces take 1 irreversibly.
      onTranscript(transcript);
    }

    setTakeCount((c) => c + 1);
    setState({ kind: "idle" });
  }, [state, onTranscript]);

  // Keep the ref current so the silence timer can call the latest handleStop.
  useEffect(() => {
    handleStopRef.current = handleStop;
  }, [handleStop]);

  // --- Render ---------------------------------------------------------------

  if (state.kind === "unsupported") {
    // Mic hidden where unsupported (spec §6 failure mode 1). Typing primary.
    return null;
  }

  const micDead = takeCount >= 2 || disabled;
  const isRecording = state.kind === "recording";

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          if (!micDead && !isRecording) handleStart();
        }}
        onPointerUp={(e) => {
          e.preventDefault();
          if (isRecording) handleStop();
        }}
        onPointerLeave={() => {
          if (isRecording) handleStop();
        }}
        disabled={micDead}
        className={cn(
          "relative flex items-center justify-center w-14 h-14 rounded-full border-2 transition-colors select-none touch-none",
          micDead && "opacity-40 cursor-not-allowed border-muted-foreground/30",
          !micDead && !isRecording && "border-foreground/40 hover:border-foreground/60 hover:bg-muted/50",
          isRecording && "border-rose-500 bg-rose-50",
        )}
        aria-label={
          micDead
            ? "Microphone disabled — you've used both recordings. Edit the transcript by hand."
            : isRecording
              ? "Release to stop recording"
              : "Press and hold to record"
        }
      >
        {micDead ? (
          <MicOff className="w-5 h-5 text-muted-foreground" />
        ) : (
          <Mic className={cn("w-5 h-5", isRecording && "text-rose-600")} />
        )}
        {isRecording && (
          // Draining progress ring
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 56 56">
            <circle
              cx="28"
              cy="28"
              r="26"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-rose-200"
            />
            <circle
              cx="28"
              cy="28"
              r="26"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-rose-500 transition-all"
              strokeDasharray={`${2 * Math.PI * 26}`}
              strokeDashoffset={`${2 * Math.PI * 26 * progress}`}
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>

      {/* Waveform — only while recording */}
      {isRecording && (
        <div className="flex items-center gap-0.5 h-6" aria-hidden>
          {waveform.map((v, i) => (
            <span
              key={i}
              className="w-0.5 bg-rose-500 rounded-full transition-all"
              style={{ height: `${Math.max(2, v * 24)}px` }}
            />
          ))}
        </div>
      )}

      {/* Status / copy */}
      <div className="text-xs text-center min-h-[1.5rem]">
        {isRecording ? (
          <span className="text-rose-600 font-medium">
            Recording… {Math.ceil((90 * (1 - progress)))}s left. Release to stop.
          </span>
        ) : micDead ? (
          <span className="text-muted-foreground">
            Both recordings used. Edit the transcript by hand.
          </span>
        ) : takeCount === 0 ? (
          <span className="text-muted-foreground">
            Press and hold to record. One re-record available.
          </span>
        ) : takeCount === 1 ? (
          <span className="text-muted-foreground">
            Take 1 captured. One more recording available, then hand-edit.
          </span>
        ) : null}
      </div>

      {state.kind === "error" && (
        <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 max-w-xs">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>{state.message}</span>
        </div>
      )}
    </div>
  );
}
