import { createContext, useContext, useState, ReactNode } from "react";

export type ClipboardData =
  | { source: "local"; items: Array<{ path: string; name: string; is_directory: boolean }> }
  | { source: "s3"; items: Array<{ bucket: string; key: string; is_prefix: boolean }>; prefix: string };

interface ClipboardContextValue {
  clipboard: ClipboardData | null;
  setClipboard: (data: ClipboardData | null) => void;
}

const ClipboardContext = createContext<ClipboardContextValue>({
  clipboard: null,
  setClipboard: () => {},
});

export function ClipboardProvider({ children }: { children: ReactNode }) {
  const [clipboard, setClipboard] = useState<ClipboardData | null>(null);

  return (
    <ClipboardContext.Provider value={{ clipboard, setClipboard }}>
      {children}
    </ClipboardContext.Provider>
  );
}

export function useClipboard() {
  return useContext(ClipboardContext);
}
