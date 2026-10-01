import { createPortal } from 'react-dom';

// Rendered into <body> so page layout (e.g. space-y-* margins on siblings)
// can't offset the full-screen backdrop.
export default function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        className={`relative z-10 w-full rounded-xl border border-gray-200 bg-white p-6 shadow-2xl ${
          wide ? 'max-w-2xl' : 'max-w-lg'
        } max-h-[90vh] overflow-y-auto`}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#0D3040]">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {children}
      </div>
    </div>,
    document.body
  );
}
