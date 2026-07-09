import { motion } from "framer-motion";
import { UploadCloud } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { ACCEPT_ATTR, ACCEPTED_EXTENSIONS } from "@/features/datasets/upload-utils";
import { cn } from "@/lib/utils";

interface UploadDropzoneProps {
  onFiles: (files: File[]) => void;
  compact?: boolean;
}

export function UploadDropzone({ onFiles, compact }: UploadDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (list: FileList | null) => {
      if (list && list.length) onFiles(Array.from(list));
    },
    [onFiles],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        compact ? "gap-2 p-6" : "gap-3 p-10",
        dragging
          ? "border-primary bg-primary/5"
          : "border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50",
      )}
    >
      {dragging && <div className="pointer-events-none absolute inset-0 bg-mesh opacity-60" />}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <motion.div
        animate={{ y: dragging ? -4 : 0, scale: dragging ? 1.05 : 1 }}
        className={cn(
          "relative grid place-items-center rounded-2xl transition-colors",
          compact ? "size-11" : "size-14",
          dragging ? "bg-brand-gradient text-white" : "bg-brand-gradient-soft text-primary",
        )}
      >
        <UploadCloud className={compact ? "size-5" : "size-7"} />
      </motion.div>
      <div className="relative">
        <p className="text-sm font-semibold">
          {dragging ? "Drop to upload" : "Drag & drop files, or click to browse"}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {ACCEPTED_EXTENSIONS.join(", ")} · up to 100MB · multiple files supported
        </p>
      </div>
    </div>
  );
}
