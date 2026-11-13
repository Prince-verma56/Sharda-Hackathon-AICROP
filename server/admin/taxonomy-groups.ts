import 'server-only';
import { cropName } from '@/lib/crops';
import { tryGetTaxonomy } from '@/server/cropai/taxonomy';

/** Model taxonomy grouped for select inputs (only real classes). */
export async function getTaxonomyGroups() {
  const taxonomy = await tryGetTaxonomy();
  return (taxonomy?.crops ?? []).map((c) => ({ crop: c.id, name: cropName(c.id), classes: c.classes.map((k) => ({ label: k.label, name: k.name })) }));
}
