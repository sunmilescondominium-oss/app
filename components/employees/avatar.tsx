/** Staff avatar — signed photo via the API route, or initials fallback. */
export function Avatar({
  id,
  label,
  photoPath,
  size = 40,
}: {
  id: string;
  label: string;
  photoPath: string | null;
  size?: number;
}) {
  const initials =
    label
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  if (photoPath) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={`/api/staff/${id}/photo`}
        alt={label}
        className="shrink-0 rounded-full object-cover ring-1 ring-slate-200"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-amber-100 font-semibold text-amber-800 ring-1 ring-amber-200"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </span>
  );
}
