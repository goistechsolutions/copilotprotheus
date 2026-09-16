import { useEffect, useRef, useCallback } from 'react';

export function useAutoScroll<T extends HTMLElement>(dependencies: any[] = []) {
  const containerRef = useRef<T | null>(null);
  const isUserScrolledUpRef = useRef<boolean>(false);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    // Se estiver a mais de 80px do fundo, considera que o usuário rolou para cima
    isUserScrolledUpRef.current = distanceToBottom > 80;
  }, []);

  const scrollToBottom = useCallback((force = false) => {
    const el = containerRef.current;
    if (!el) return;
    if (force || !isUserScrolledUpRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, dependencies);

  return { containerRef, handleScroll, scrollToBottom };
}
