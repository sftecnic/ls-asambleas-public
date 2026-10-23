import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRepository } from '../src/data/repository';
import { createDemoData } from '../src/seed';

beforeEach(() => {
  const map = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => map.set(key, value), removeItem: (key: string) => map.delete(key) });
  vi.stubGlobal('navigator', { onLine: true });
});
describe('Repositorio demostración: persistencia y control de versiones', () => {
  it('guarda cambio y auditoría juntos y los recupera al abrir otra instancia', async () => {
    const repo = createRepository(createDemoData()), user = await repo.signIn(), before = await repo.loadData(user), next = structuredClone(before);
    next.persons[1].phone = '600000000';
    const saved = await repo.commit(before, next, 'Teléfono actualizado', user, 'e1');
    expect(saved.persons.find(p => p.id === 'p1')?.revision).toBe(1);
    expect(saved.audit.at(-1)?.actor).toBe(user.name);
    const reopened = createRepository();
    expect((await reopened.loadData(user)).persons.find(p => p.id === 'p1')?.phone).toBe('600000000');
  });
  it('rechaza un formulario desactualizado en otra pestaña y conserva el cambio ganador', async () => {
    const one = createRepository(createDemoData()), two = createRepository(createDemoData()), user = await one.signIn();
    const base = await one.loadData(user), first = structuredClone(base), second = structuredClone(base);
    first.persons[1].name = 'Primera edición'; second.persons[1].name = 'Segunda edición';
    await one.commit(base, first, 'Primera', user, 'e1');
    await expect(two.commit(base, second, 'Segunda', user, 'e1')).rejects.toThrow('Otra persona');
    expect((await createRepository().loadData(user)).persons.find(p => p.id === 'p1')?.name).toBe('Primera edición');
  });
  it('rechaza el row revision viejo incluso si before ya se ha actualizado', async () => {
    const repo = createRepository(createDemoData()), user = await repo.signIn(), original = await repo.loadData(user), first = structuredClone(original);
    first.persons[1].name = 'Cambio recibido';
    const current = await repo.commit(original, first, 'Cambio', user, 'e1'), stale = structuredClone(current);
    stale.persons = stale.persons.map(p => p.id === 'p1' ? { ...original.persons[1], name: 'Formulario antiguo' } : p);
    await expect(repo.commit(current, stale, 'Antiguo', user, 'e1')).rejects.toThrow('versión anterior');
  });
  it('sin conexión no escribe ni crea una cola', async () => {
    const repo = createRepository(createDemoData()), user = await repo.signIn(), before = await repo.loadData(user), next = structuredClone(before);
    next.persons[1].name = 'Sin conexión'; vi.stubGlobal('navigator', { onLine: false });
    await expect(repo.commit(before, next, 'Cambio offline', user, 'e1')).rejects.toThrow('Sin conexión');
    expect((await repo.loadData(user)).persons[1].name).toBe(before.persons[1].name);
    expect((await repo.loadData(user)).audit).toEqual(before.audit);
  });
});
