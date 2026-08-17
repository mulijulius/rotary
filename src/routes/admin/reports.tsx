import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileText, Download } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/reports")({
  component: AdminFinancialReports,
});

type TrialBalance = {
  code: string;
  name: string;
  type: string;
  total_debit: number;
  total_credit: number;
  balance: number;
};

type MemberBalance = {
  member_id: bigint;
  member_name: string;
  ri_number: string;
  balance_due: number;
};

type AttendanceSummary = {
  member_id: bigint;
  member_name: string;
  meetings_required: number;
  meetings_attended: number;
  attendance_pct: number;
};

function AdminFinancialReports() {
  const { role } = useAuth();
  const [trialBalance, setTrialBalance] = useState<TrialBalance[] | null>(null);
  const [memberBalances, setMemberBalances] = useState<MemberBalance[] | null>(null);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary[] | null>(null);

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    try {
      const [trialResult, memberResult, attendanceResult] = await Promise.all([
        supabase.from("v_trial_balance").select("*"),
        supabase.from("v_member_balances").select("*"),
        supabase.from("v_attendance_summary").select("*"),
      ]);

      if (trialResult.error) throw trialResult.error;
      if (memberResult.error) throw memberResult.error;
      if (attendanceResult.error) throw attendanceResult.error;

      setTrialBalance(trialResult.data as any);
      setMemberBalances(memberResult.data as any);
      setAttendanceSummary(attendanceResult.data as any);
    } catch (err) {
      console.error("[admin/reports] failed to load", err);
      toast.error("Couldn't load reports.");
    }
  }

  function downloadCSV(data: any[], filename: string) {
    if (!data || data.length === 0) {
      toast.error("No data to export.");
      return;
    }

    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(","),
      ...data.map((row) => headers.map((h) => {
        const val = row[h];
        if (typeof val === "string" && val.includes(",")) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val ?? "";
      }).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    toast.success(`${filename} downloaded.`);
  }

  if (role && !["admin", "treasurer"].includes(role)) {
    return <div className="text-muted-foreground">You don't have access to financial reports.</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Financial Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">View and export financial statements and summaries.</p>
        </div>
      </div>

      <div className="mt-6">
        <Tabs defaultValue="trial-balance" className="w-full">
          <TabsList>
            <TabsTrigger value="trial-balance">Trial Balance</TabsTrigger>
            <TabsTrigger value="member-balances">Member Balances</TabsTrigger>
            <TabsTrigger value="attendance">Attendance Summary</TabsTrigger>
          </TabsList>

          <TabsContent value="trial-balance" className="space-y-4">
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => downloadCSV(trialBalance || [], "trial-balance.csv")}
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Account Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Debits</TableHead>
                    <TableHead className="text-right">Credits</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trialBalance === null && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        Loading…
                      </TableCell>
                    </TableRow>
                  )}
                  {trialBalance?.map((row) => (
                    <TableRow key={row.code}>
                      <TableCell className="font-mono font-semibold">{row.code}</TableCell>
                      <TableCell className="font-semibold">{row.name}</TableCell>
                      <TableCell className="text-sm">{row.type}</TableCell>
                      <TableCell className="text-right font-mono">
                        {parseFloat(row.total_debit.toString()).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {parseFloat(row.total_credit.toString()).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {parseFloat(row.balance.toString()).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="member-balances" className="space-y-4">
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => downloadCSV(memberBalances || [], "member-balances.csv")}
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member Name</TableHead>
                    <TableHead>RI Number</TableHead>
                    <TableHead className="text-right">Balance Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {memberBalances === null && (
                    <TableRow>
                      <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                        Loading…
                      </TableCell>
                    </TableRow>
                  )}
                  {memberBalances?.map((row) => (
                    <TableRow key={row.member_id}>
                      <TableCell className="font-semibold">{row.member_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.ri_number}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {parseFloat(row.balance_due.toString()).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="attendance" className="space-y-4">
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => downloadCSV(attendanceSummary || [], "attendance-summary.csv")}
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member Name</TableHead>
                    <TableHead className="text-right">Meetings Required</TableHead>
                    <TableHead className="text-right">Attended</TableHead>
                    <TableHead className="text-right">Attendance %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceSummary === null && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                        Loading…
                      </TableCell>
                    </TableRow>
                  )}
                  {attendanceSummary?.map((row) => (
                    <TableRow key={row.member_id}>
                      <TableCell className="font-semibold">{row.member_name}</TableCell>
                      <TableCell className="text-right">{row.meetings_required}</TableCell>
                      <TableCell className="text-right font-semibold">{row.meetings_attended}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {row.attendance_pct ? `${parseFloat(row.attendance_pct.toString()).toFixed(1)}%` : "N/A"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
