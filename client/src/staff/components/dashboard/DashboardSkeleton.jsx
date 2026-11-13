// Grey pulse blocks in the same layout as the dashboard, shown while it loads.
const Block = ({ className = '' }) => <div className={`animate-pulse rounded-xl bg-gray-200/70 ${className}`} />;

export default function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="space-y-2">
        <Block className="h-8 w-64" />
        <Block className="h-4 w-40" />
      </div>
      <Block className="h-16" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Block key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Block className="h-64" />
        <Block className="h-64" />
      </div>
      <Block className="h-28" />
    </div>
  );
}
