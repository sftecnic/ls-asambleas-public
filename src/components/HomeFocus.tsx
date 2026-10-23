import { ArrowLeft } from "lucide-react";
import type { HomeIntent } from "../domain/homeDashboard";

export default function HomeFocus({
  intent,
  onClear,
}: {
  intent?: HomeIntent;
  onClear: () => void;
}) {
  if (!intent?.filter && !(intent && intent.departmentIds.length > 1))
    return null;
  return (
    <div
      className="home-focus no-print"
      role="region"
      aria-label="Filtro desde Inicio"
    >
      <strong>{intent.label}</strong>
      <button className="btn" onClick={onClear}>
        <ArrowLeft size={18} aria-hidden="true" />
        Quitar filtro
      </button>
    </div>
  );
}
