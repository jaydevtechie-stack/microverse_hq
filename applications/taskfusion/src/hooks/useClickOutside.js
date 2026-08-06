import { useEffect } from 'react';

// Closes a dropdown/menu when the user clicks anywhere outside `ref` —
// Navbar's avatar dropdown is the first consumer.
export default function useClickOutside(ref, onOutside) {
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onOutside();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onOutside]);
}
