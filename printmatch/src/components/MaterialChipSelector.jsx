import { MATERIALS } from "../data/mockData";

/**
 * Renders a row of material chips.
 * - Read-only mode: pass `materials` to just display a list.
 * - Selectable mode: pass `selected` + `onChange` (single or multi via `multi`).
 */
export default function MaterialChipSelector({
  materials = MATERIALS,
  selected,
  onChange,
  multi = false,
}) {
  const isSelectable = typeof onChange === "function";

  const isActive = (m) =>
    multi ? selected?.includes(m) : selected === m;

  const handleClick = (m) => {
    if (!isSelectable) return;
    if (multi) {
      const next = selected?.includes(m)
        ? selected.filter((x) => x !== m)
        : [...(selected ?? []), m];
      onChange(next);
    } else {
      onChange(m);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {materials.map((m) => {
        const active = isActive(m);
        return (
          <button
            key={m}
            type="button"
            disabled={!isSelectable}
            onClick={() => handleClick(m)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "border-accent bg-accent text-white"
                : "border-gray-200 bg-white text-navy/70"
            } ${isSelectable ? "active:scale-95" : ""}`}
          >
            {m}
          </button>
        );
      })}
    </div>
  );
}
