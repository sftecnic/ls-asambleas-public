import { useEffect, useRef, type ReactNode } from 'react';
import { AlertTriangle, Check, Clock3, Pencil, X, Video, Presentation, Brush, Users, CircleHelp } from 'lucide-react';
import type { Department } from '../domain/types';

export function Status({ kind, children }: { kind: 'good' | 'pending' | 'error' | 'draft' | 'info'; children: ReactNode }) {
  const Icon = { good: Check, pending: Clock3, error: AlertTriangle, draft: Pencil, info: CircleHelp }[kind];
  return <span className={`status status-${kind}`}><Icon size={18} aria-hidden="true" />{children}</span>;
}
export function DepartmentIcon({ department, size = 24 }: { department?: Department; size?: number }) {
  const Icon = { video: Video, platform: Presentation, makeup: Brush, other: Users }[department?.icon ?? 'other'];
  return <Icon size={size} aria-hidden="true" />;
}
export function Modal({ title, children, onClose, wide = false, titleAction }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean; titleAction?:ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const opener = useRef(document.activeElement as HTMLElement | null);
  useEffect(() => {
    const dialog = ref.current;
    if(titleAction&&closeButton.current)closeButton.current.autofocus=true;
    dialog?.showModal();
    if(titleAction)closeButton.current?.focus({preventScroll:true});
    return () => { dialog?.close(); requestAnimationFrame(() => { if (opener.current?.isConnected) opener.current.focus(); }); };
  }, []);
  return <dialog ref={ref} className={`modal ${wide ? 'modal-wide' : ''}`} aria-label={title} onCancel={e => { e.preventDefault(); onClose(); }}><div className="modal-heading"><div className="modal-title-contact"><h2>{title}</h2>{titleAction}</div><button className="btn btn-ghost" ref={closeButton} onClick={onClose}><X size={20} />Cerrar</button></div>{children}</dialog>;
}
export function Empty({ children }: { children: ReactNode }) { return <div className="empty-state"><CircleHelp size={28} /><p>{children}</p></div>; }
export function ErrorMessage({ message }: { message: string }) {
  if (!message) return null;
  let text = message;
  if (/auth\/popup-closed-by-user|auth\/cancelled-popup-request/.test(message)) text = 'Se cerró la ventana de Google. Pulsa «Entrar con Google» para volver a intentarlo.';
  else if (/auth\/popup-blocked/.test(message)) text = 'Permite abrir la ventana de Google y vuelve a entrar.';
  else if (/auth\/unauthorized-domain/.test(message)) text = 'No se puede entrar desde esta dirección. Usa el enlace de LS Asambleas.';
  else if (/permission-denied|Missing or insufficient permissions/i.test(message)) text = 'Tu permiso ha cambiado. Actualiza la página o contacta con tu responsable.';
  else if (/resource-exhausted|quota-exceeded/i.test(message)) text = 'Se ha alcanzado el límite gratuito del servicio. Inténtalo más tarde.';
  else if (/network-request-failed|unavailable|client is offline/i.test(message)) text = 'No hay conexión con el servicio. Conserva esta página y vuelve a intentarlo.';
  else if (/^Firebase:/i.test(message)) text = 'No se pudo completar la acción. Vuelve a intentarlo.';
  return <div className="message error" role="alert"><AlertTriangle size={22} /><span>{text}</span></div>;
}
export function Confirm({ title, children, action, onConfirm, onClose }: { title: string; children: ReactNode; action: string; onConfirm: () => Promise<void>; onClose: () => void }) {
  const ref = useRef(false);
  return <Modal title={title} onClose={onClose}><div>{children}</div><div className="modal-actions"><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={async () => { if (ref.current) return; ref.current = true; try { await onConfirm(); onClose(); } finally { ref.current = false; } }}>{action}</button></div></Modal>;
}
