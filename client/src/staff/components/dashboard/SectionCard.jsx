import { Link } from 'react-router-dom';

// Card with a title on the left and an optional "View all →" link on the right.
export default function SectionCard({ title, count, linkTo, linkLabel = 'View all', children, className = '' }) {
  return (
    <section className={`card flex flex-col p-4 ${className}`}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">
          {title}
          {count != null && (
            <span className={`ml-1.5 font-normal text-gray-400 ${typeof count === 'number' ? 'num' : ''}`}>{count}</span>
          )}
        </h2>
        {linkTo && (
          <Link to={linkTo} className="text-xs text-gray-500 hover:text-brand-600">
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
