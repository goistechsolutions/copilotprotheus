import { useRef, useEffect, useCallback } from 'react';

export function useAutoResizeTextarea(value: string, maxHeight = 128) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const scrollHeight = el.scrollHeight;
    el.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
  }, [maxHeight]);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  return { textareaRef, adjustHeight };
}
