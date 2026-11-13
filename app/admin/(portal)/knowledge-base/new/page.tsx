import { getTaxonomyGroups } from '@/server/admin/taxonomy-groups';
import { requireStaff } from '@/server/auth/dal';
import { can } from '@/server/auth/rbac';
import { researchConfigured } from '@/server/cropai/research';
import { PageHeader } from '../../ui';
import { KnowledgeEditor } from '../knowledge-editor';

export const metadata = { title: 'New knowledge entry' };

export default async function NewKnowledgeEntry({ searchParams }: { searchParams: Promise<{ label?: string }> }) {
  const staff = await requireStaff('knowledge:edit');
  const groups = await getTaxonomyGroups();
  const label = (await searchParams).label ?? '';
  return (
    <>
      <PageHeader title="New knowledge entry" description="Write guidance for one model condition. Cite a source; another expert approves it." />
      <KnowledgeEditor
        groups={groups}
        canEdit
        canApprove={false}
        canResearch={can(staff.role, 'research:use') && researchConfigured()}
        initial={{ conditionLabel: label, title: '', summary: '', symptoms: [], causes: [], inspectionSteps: [], prevention: [], approvedTreatment: [], furtherTesting: [], regions: [], sourceUrl: '', sourceOrganisation: '', referenceImageCredit: '', hasReferenceImage: false }}
      />
    </>
  );
}
