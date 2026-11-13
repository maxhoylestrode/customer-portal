import { Link } from 'react-router-dom';

// White card with a title on the left and an optional "View all →" link on the right.
export default function SectionCard({ title, linkTo, linkLabel = 'View all', children, className = '' }) {
  return (
    <section className={`card p-5 ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-brand-700">{title}</h2>
        {linkTo && (
          <Link to={linkTo} className="text-xs text-brand-600 hover:underline">
            {linkLabel} →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export function EmptyLine({ children }) {
  return <p className="py-4 text-center text-sm text-gray-400">{children}</p>;
}
