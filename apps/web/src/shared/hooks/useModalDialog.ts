import { useEffect, useRef } from 'react';

/** Native Escape/focus handling plus backdrop click, without dismissing padding or drags. */
export function useModalDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    if (!dialog.open) dialog.showModal();
    const outside = (event: MouseEvent) => {
      const rect = dialog.getBoundingClientRect();
      return (
        event.target === dialog &&
        (event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom)
      );
    };
    let beganOutside = false;
    const down = (event: PointerEvent) => {
      beganOutside = outside(event);
    };
    const click = (event: MouseEvent) => {
      if (beganOutside && outside(event)) dialog.close();
      beganOutside = false;
    };
    dialog.addEventListener('pointerdown', down);
    dialog.addEventListener('click', click);
    return () => {
      dialog.removeEventListener('pointerdown', down);
      dialog.removeEventListener('click', click);
    };
  }, []);
  return ref;
}
