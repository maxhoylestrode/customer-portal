// Grey pulse blocks in the same layout as the dashboard, shown while it loads.
const Block = ({ className = '' }) => <div className={`animate-pulse rounded-xl bg-gray-100 ${className}`} />;

export default function DashboardSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading dashboard">
      <div className="space-y-2">
        <Block className="h-7 w-64" />
        <Block className="h-6 w-80" />
      </div>
      <Block className="h-28" />
      <div className="grid gap-5 xl:grid-cols-3">
        <Block className="h-72 xl:col-span-2" />
        <Block className="h-72" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <Block className="h-56" />
        <Block className="h-56" />
        <Block className="h-56" />
      </div>
    </div>
  );
}
