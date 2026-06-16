type AuthPageHeaderProps = {
  title: string;
  subtitle: string;
};

export function AuthPageHeader({ title, subtitle }: AuthPageHeaderProps) {
  return (
    <div>
      <p className="text-center text-3xl font-bold text-primary mb-2 font-display" aria-label="Bloggr Admin">
        Bloggr
      </p>
      <p className="text-center text-xs uppercase tracking-widest text-gray-500 mb-2">Platform Admin</p>
      <h2 className="text-center text-2xl font-bold text-white mt-2">{title}</h2>
      <p className="mt-2 text-center text-sm text-gray-400">{subtitle}</p>
    </div>
  );
}
