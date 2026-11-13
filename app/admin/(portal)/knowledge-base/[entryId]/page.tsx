import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getTaxonomyGroups } from '@/server/admin/taxonomy-groups';
import { requireStaff } from '@/server/auth/dal';
import { can } from '@/server/auth/rbac';
import { researchConfigured } from '@/server/cropai/research';
import { db } from '@/server/db';
import { fmtDate, PageHeader } from '../../ui';
import { KnowledgeEditor } from '../knowledge-editor';

export const metadata = { title: 'Knowledge entry' };

export default async function KnowledgeEntryPage({ params }: { params: Promise<{ entryId: string }> }) {
  const staff = await requireStaff('knowledge:view');
  const { entryId } = await params;
  const [e, groups] = await Promise.all([
    db.knowledgeEntry.findUnique({ where: { id: entryId }, include: { createdBy: { select: { name: true } }, reviewedBy: { select: { name: true } } } }),
    getTaxonomyGroups(),
  ]);
  if (!e) notFound();
  return (
    <>
      <Link href="/admin/knowledge-base" className="mb-3 flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Knowledge base</Link>
      <PageHeader
        title={e.title}
        description={`v${e.version} · by ${e.createdBy.name ?? '—'} · updated ${fmtDate(e.updatedAt)}${e.reviewedAt ? ` · last decision by ${e.reviewedBy?.name ?? '—'} ${fmtDate(e.reviewedAt)}` : ''}${e.reviewNote ? ` · note: ${e.reviewNote}` : ''}`}
      />
      <KnowledgeEditor
        groups={groups}
        status={e.status}
        canEdit={can(staff.role, 'knowledge:edit')}
        canApprove={can(staff.role, 'knowledge:approve')}
        canResearch={can(staff.role, 'research:use') && researchConfigured()}
        initial={{ id: e.id, conditionLabel: e.conditionLabel, title: e.title, summary: e.summary, symptoms: e.symptoms, causes: e.causes, inspectionSteps: e.inspectionSteps, prevention: e.prevention, approvedTreatment: e.approvedTreatment, furtherTesting: e.furtherTesting, regions: e.regions, sourceUrl: e.sourceUrl ?? '', sourceOrganisation: e.sourceOrganisation ?? '', referenceImageCredit: e.referenceImageCredit ?? '', hasReferenceImage: Boolean(e.referenceImageKey) }}
      />
    </>
  );
}
