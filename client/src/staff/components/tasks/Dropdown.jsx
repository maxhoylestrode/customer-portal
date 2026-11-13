import { useEffect, useRef, useState } from 'react';

// Small click-to-open menu. `trigger` is what you click; `children` is the
// menu body (or a function that receives `close`). Clicks never bubble up, so
// it can sit inside a clickable row or card.
export default function Dropdown({ trigger, children, align = 'left', className = '', buttonClassName = '', title }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative inline-block ${className}`} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        title={title}
        onClick={() => setOpen((o) => !o)}
        className={`rounded-md text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${buttonClassName}`}
      >
        {trigger}
      </button>
      {open && (
        <div
          className={`absolute z-30 mt-1 min-w-[11rem] rounded-lg border border-gray-200 bg-white py-1 shadow-lg ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}
