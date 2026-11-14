import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ComponentPropsWithoutRef,
} from 'react';

/** Floating menus dismiss outside; inline disclosures deliberately remain independent. */
export const PopupDetails = forwardRef<HTMLDetailsElement, ComponentPropsWithoutRef<'details'>>(
  function PopupDetails(props, forwardedRef) {
    const ref = useRef<HTMLDetailsElement>(null);
    useImperativeHandle(forwardedRef, () => ref.current!, []);
    useEffect(() => {
      const menu = ref.current!;
      const outside = (event: Event) => {
        if (menu.open && event.target instanceof Node && !menu.contains(event.target))
          menu.open = false;
      };
      const escape = (event: KeyboardEvent) => {
        if (!menu.open || event.key !== 'Escape' || document.querySelector('dialog[open]')) return;
        event.preventDefault();
        event.stopPropagation();
        menu.open = false;
        menu.querySelector('summary')?.focus();
      };
      document.addEventListener('pointerdown', outside, true);
      document.addEventListener('click', outside, true);
      document.addEventListener('focusin', outside);
      document.addEventListener('keydown', escape, true);
      return () => {
        document.removeEventListener('pointerdown', outside, true);
        document.removeEventListener('click', outside, true);
        document.removeEventListener('focusin', outside);
        document.removeEventListener('keydown', escape, true);
      };
    }, []);
    return <details {...props} name="cockpit-popups" ref={ref} />;
  },
);
