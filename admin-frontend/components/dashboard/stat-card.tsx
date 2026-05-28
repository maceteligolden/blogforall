import { cn } from "@/lib/utils/cn";

type StatCardProps = {
  label: string;
  value: number | string;
  description?: string;
  loading?: boolean;
  onClick?: () => void;
};

export function StatCard({ label, value, description, loading, onClick }: StatCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-lg border border-gray-800 bg-gray-900/60 p-6 backdrop-blur-sm transition hover:border-gray-700 hover:bg-gray-900"
    >
      <p className="text-sm font-medium text-gray-400">{label}</p>
      {loading ? (
        <div className="mt-3 h-9 w-24 animate-pulse rounded bg-gray-800" />
      ) : (
        <p className="mt-2 text-3xl font-bold text-white tabular-nums">{value}</p>
      )}
      {description && <p className="mt-2 text-xs text-gray-500">{description}</p>}
    </button>
  );
}

export function StatCardGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>{children}</div>;
}
