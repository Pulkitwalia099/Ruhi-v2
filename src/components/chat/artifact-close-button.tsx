import { memo } from "react";
import { initialArtifactData, useArtifact } from "@/hooks/use-artifact";
import { CrossIcon } from "./icons";

// -----------------------------------------
// src/components/chat/artifact-close-button.tsx
//
// function PureArtifactCloseButton()    L12
// export const ArtifactCloseButton      L36
// -----------------------------------------

function PureArtifactCloseButton() {
  const { setArtifact } = useArtifact();

  return (
    <button
      className="group flex size-8 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition-all duration-150 hover:border-border hover:bg-muted hover:text-foreground active:scale-95"
      data-testid="artifact-close-button"
      onClick={() => {
        setArtifact((currentArtifact) =>
          currentArtifact.status === "streaming"
            ? {
                ...currentArtifact,
                isVisible: false,
              }
            : { ...initialArtifactData, status: "idle" }
        );
      }}
      type="button"
    >
      <CrossIcon size={16} />
    </button>
  );
}

export const ArtifactCloseButton = memo(PureArtifactCloseButton, () => true);
