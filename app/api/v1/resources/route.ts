/**
 * GET /api/v1/resources — the verified government resources and data-rights summary shown on the
 * public /resources and /data-rights pages (single source: components/marketing/legal/content.ts).
 * Official links only, each with the date it was last checked. No scheme status or eligibility is
 * stated or inferred. Public (no sign-in), so the app can cache it for offline reading.
 */
import { contactEmail, DATA_RIGHTS, GOV_RESOURCE_GROUPS, RESOURCES_LAST_CHECKED } from '@/components/marketing/legal/content';
import { limit, ok } from '@/server/http/respond';

export async function GET(req: Request) {
  const limited = await limit(req, 'resources', 60);
  if (limited) return limited;
  return ok({
    lastChecked: RESOURCES_LAST_CHECKED.iso,
    groups: GOV_RESOURCE_GROUPS.map((g) => ({
      id: g.id,
      title: { en: g.title, hi: g.hindi },
      resources: g.resources.map((r) => ({
        name: { en: r.name, hi: r.hindi },
        description: r.description,
        url: r.url,
        linkNote: r.linkNote ?? null,
        icon: r.icon,
        checked: r.checked,
        phone: r.phone ?? null,
      })),
    })),
    dataRights: DATA_RIGHTS.map((d) => ({ ...d })),
    contactEmail: contactEmail(),
  });
}
