// Program folder tree helpers. Pure.
export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
}

export function childrenOf(all: Folder[], parent: string | null): Folder[] {
  return all.filter((f) => f.parent_id === parent).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

/** Root → folder, e.g. [Combat sports, Peaking]. Empty for the top level or an unknown id. */
export function pathTo(all: Folder[], id: string | null): Folder[] {
  const by = new Map(all.map((f) => [f.id, f]));
  const out: Folder[] = [];
  let cur = id ? by.get(id) : undefined;
  while (cur && out.length < 10) {
    out.unshift(cur);
    cur = cur.parent_id ? by.get(cur.parent_id) : undefined;
  }
  return out;
}

export function descendants(all: Folder[], id: string): Set<string> {
  const out = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of all)
      if (f.parent_id && out.has(f.parent_id) && !out.has(f.id)) {
        out.add(f.id);
        grew = true;
      }
  }
  return out;
}

/** Flat list for a <select>: "Combat sports › Peaking". */
export function folderOptions(all: Folder[]): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  const walk = (parent: string | null, prefix: string) => {
    for (const f of childrenOf(all, parent)) {
      const label = prefix ? `${prefix} › ${f.name}` : f.name;
      out.push({ id: f.id, label });
      walk(f.id, label);
    }
  };
  walk(null, "");
  return out;
}
