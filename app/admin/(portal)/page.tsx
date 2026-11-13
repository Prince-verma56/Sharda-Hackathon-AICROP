import Link from "next/link";
import {
  ClipboardCheck,
  MapPinned,
  ScanSearch,
  Sprout,
  ThumbsUp,
  Users,
} from "lucide-react";
import { buttonVariants, Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cropName } from "@/lib/crops";
import { getOverview } from "@/server/admin/queries";
import { Input } from "@/components/ui/input";
import { requireStaff } from "@/server/auth/dal";
import { saveStaffName } from "@/server/admin/profile-actions";
import { can } from "@/server/auth/rbac";
import {
  EmptyState,
  fmtDate,
  PageHeader,
  pct,
  ReviewBadge,
  StatCard,
} from "./ui";

export const metadata = { title: "Overview" };

export default async function AdminOverview() {
  const staff = await requireStaff("overview:view");
  const o = await getOverview();
  return (
    <>
      <PageHeader
        title={`Welcome${staff.name ? `, ${staff.name.split(" ")[0]}` : ""}`}
        description="Live figures from the platform database."
        actions={
          can(staff.role, "reviews:write") && o.pending > 0 ? (
            <Link href="/admin/expert-review" className={buttonVariants()}>
              Review {o.pending} pending
            </Link>
          ) : null
        }
      />
      {!staff.name && (
        <Card className="mb-6 rounded-2xl border-amber-200 bg-amber-50/60">
          <CardHeader>
            <CardTitle>Complete your admin profile</CardTitle>
            <CardDescription>
              Your name appears on expert reviews and in the audit log.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={saveStaffName} className="flex max-w-md gap-2">
              <Input
                name="name"
                required
                minLength={2}
                maxLength={80}
                placeholder="Your full name"
                aria-label="Your full name"
                className="bg-white"
              />
              <Button type="submit">Save</Button>
            </form>
          </CardContent>
        </Card>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Farmers" value={o.farmers} icon={Users} />
        <StatCard label="Farms" value={o.farms} icon={MapPinned} />
        <StatCard
          label="Diagnoses"
          value={o.diagnoses}
          hint={`${o.diagnoses7} in the last 7 days`}
          icon={ScanSearch}
        />
        <StatCard
          label="Crops used"
          value={o.cropsUsed}
          hint="of 59 supported"
          icon={Sprout}
        />
        <StatCard
          label="Pending reviews"
          value={o.pending}
          icon={ClipboardCheck}
        />
        <StatCard
          label="Helpful feedback"
          value={
            o.feedback.total ? pct(o.feedback.helpful / o.feedback.total) : "—"
          }
          hint={
            o.feedback.total
              ? `${o.feedback.total} responses`
              : "No feedback yet"
          }
          icon={ThumbsUp}
        />
      </div>

      <Card className="mt-6 rounded-2xl">
        <CardHeader>
          <CardTitle>Recent diagnoses</CardTitle>
        </CardHeader>
        <CardContent>
          {o.recent.length === 0 ? (
            <EmptyState
              title="No diagnoses yet"
              text="When farmers check crops, real results appear here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Crop</TableHead>
                  <TableHead>Predicted condition</TableHead>
                  <TableHead className="text-right">Model score</TableHead>
                  <TableHead>Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {o.recent.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-muted-foreground">
                      {fmtDate(d.createdAt)}
                    </TableCell>
                    <TableCell>{cropName(d.predictedCrop)}</TableCell>
                    <TableCell>
                      {can(staff.role, "diagnoses:view") ? (
                        <Link
                          className="font-medium hover:underline"
                          href={`/admin/diagnoses/${d.id}`}
                        >
                          {d.predictedCondition}
                        </Link>
                      ) : (
                        d.predictedCondition
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {pct(d.confidence)}
                    </TableCell>
                    <TableCell>
                      <ReviewBadge status={d.reviewStatus} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
