"use client";

import { MicIcon, StopCircleIcon } from "lucide-react";
import { useRef, useState } from "react";
import { transcribeVoiceNote } from "@/lib/ai/transcribe-action";
import { toast } from "./toast";

interface VoiceRecorderProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
}

export function VoiceRecorder({ onTranscription, disabled }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });

        // Convert to base64 and transcribe
        const buffer = await blob.arrayBuffer();
        const base64 = btoa(
          String.fromCharCode(...new Uint8Array(buffer))
        );

        const { text, error } = await transcribeVoiceNote(base64, "audio/webm");
        if (text) {
          onTranscription(text);
        } else {
          toast({ type: "error", description: error ?? "Voice transcription failed" });
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      toast({ type: "error", description: "Microphone access denied" });
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={isRecording ? stopRecording : startRecording}
      className="flex items-center justify-center rounded-md p-1.5 transition-colors hover:bg-muted disabled:opacity-50"
      aria-label={isRecording ? "Stop recording" : "Voice input"}
    >
      {isRecording ? (
        <StopCircleIcon className="size-4 text-red-500 animate-pulse" />
      ) : (
        <MicIcon className="size-4 text-muted-foreground" />
      )}
    </button>
  );
}
