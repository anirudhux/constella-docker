import { useRef, useState, type DragEvent } from "react";

interface DropzoneProps {
  accept: string;
  onFile: (file: File) => void;
  disabled?: boolean;
  hint?: string;
}

export function Dropzone({ accept, onFile, disabled, hint }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  return (
    <div
      className={`dropzone${over ? " dropzone--over" : ""}${
        disabled ? " dropzone--disabled" : ""
      }`}
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !disabled) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 16V4m0 0L7 9m5-5 5 5M5 20h14"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p className="dropzone__main">
        Drag &amp; drop, or <span className="dropzone__browse">browse</span>
      </p>
      {hint ? <p className="dropzone__hint">{hint}</p> : null}
    </div>
  );
}
