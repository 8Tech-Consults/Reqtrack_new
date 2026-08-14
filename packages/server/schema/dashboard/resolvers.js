import { db } from '../../config/config.js';

import { formatAmount } from '../../utils/dashboard/formatAmount.js';

function monthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 10000) / 10000 : 0);

const dashboardResolvers = {
  Query: {
    requisitionStatusSummary: async () => {
      const [[totalRow]] = await db.execute(`SELECT COUNT(*) as c FROM requisitions`);
      const [[pendingRow]] = await db.execute(
        `SELECT COUNT(*) as c FROM requisitions WHERE status = 'pending' OR status IS NULL`
      );
      const [[directorRow]] = await db.execute(
        `SELECT COUNT(*) as c FROM requisitions WHERE status = 'accepted'`
      );
      const [[rejectedRow]] = await db.execute(
        `SELECT COUNT(*) as c FROM requisitions WHERE status = 'rejected'`
      );
      const [[haltedRow]] = await db.execute(
        `SELECT COUNT(*) as c FROM requisitions WHERE status = 'halted'`
      );

      const [approvedAwaitingAccountability] = await db.execute(
        `SELECT s.name as staff_name
         FROM requisitions r
         JOIN users s ON s.id = r.requested_by
         LEFT JOIN accountability_records a ON a.requisition_id = r.id
         WHERE r.status = 'approved'
           AND (a.id IS NULL OR a.status IS NULL)`
      );

      const [[amountRow]] = await db.execute(
        `SELECT SUM(total_requested_amount) as total FROM requisitions WHERE YEAR(created_at) = YEAR(CURDATE())`
      );

      const { start, end } = monthRange();
      const [[accCountRow]] = await db.execute(
        `SELECT COUNT(*) as c FROM accountability_records WHERE created_at >= ? AND created_at < ?`,
        [start, end]
      );
      const [[closedAccCountRow]] = await db.execute(
        `SELECT COUNT(*) as c FROM accountability_records WHERE created_at >= ? AND created_at < ? AND status = 'closed'`,
        [start, end]
      );

      const totalAmountRequested = amountRow.total ?? 0;

      return {
        totalRequisitions: totalRow.c,
        pendingRequisitions: pendingRow.c,
        directorRequisitions: directorRow.c,
        approvedRequisitions: approvedAwaitingAccountability.length,
        rejectedRequisitions: rejectedRow.c,
        haltedRequisitions: haltedRow.c,
        pendingAccountabilityNames: approvedAwaitingAccountability.map((r) => r.staff_name ?? '—'),
        totalAmountRequested,
        totalAmountRequestedFormatted: formatAmount(totalAmountRequested),
        accountabilitiesThisMonth: accCountRow.c,
        closedAccountabilitiesThisMonth: closedAccCountRow.c,
      };
    },

    requisitionStatusChart: async () => {
      const [[row]] = await db.execute(
        `SELECT
           COUNT(*) as total,
           SUM(status = 'pending') as pending_count,
           SUM(status = 'approved') as approved_count,
           SUM(status = 'Amendment Requested') as require_Amendment,
           SUM(status = 'rejected') as rejected_count,
           SUM(status = 'amended') as amended_count,
           SUM(status = 'accepted') as accepted_count
         FROM requisitions`
      );

      return {
        total: row.total,
        pendingCount: row.pending_count ?? 0,
        approvedCount: row.approved_count ?? 0,
        requireAmendmentCount: row.require_Amendment ?? 0,
        rejectedCount: row.rejected_count ?? 0,
        amendedCount: row.amended_count ?? 0,
        acceptedCount: row.accepted_count ?? 0,
      };
    },

    activityRequisitionData: async (_, args) => {
      const params = [];
      let where = `WHERE r.program_id IS NOT NULL`;
      if (args.programId) {
        where += ` AND r.program_id = ?`;
        params.push(args.programId);
      }

      const [grouped] = await db.execute(
        `SELECT a.name as label, SUM(r.total_requested_amount) as value
         FROM requisitions r
         JOIN program_activities a ON a.id = r.activity_id
         ${where}
         GROUP BY r.activity_id, a.name`,
        params
      );

      const [programs] = await db.execute(`SELECT * FROM programs`);

      return {
        chartData: grouped.map((g) => ({ label: g.label, value: g.value })),
        programs,
      };
    },

    accountabilitySubmissionProgress: async () => {
      const [[reqCountRow]] = await db.execute(`SELECT COUNT(*) as c FROM requisitions`);
      const [[accCountRow]] = await db.execute(`SELECT COUNT(*) as c FROM accountability_records`);
      const [[pendingRow]] = await db.execute(
        `SELECT COUNT(*) as c FROM accountability_records WHERE status IS NULL`
      );
      const [[haltedRow]] = await db.execute(
        `SELECT COUNT(*) as c FROM accountability_records WHERE status = 'halted'`
      );
      const [[acceptedRow]] = await db.execute(
        `SELECT COUNT(*) as c FROM accountability_records WHERE status = 'closed'`
      );

      const submittedPercent = reqCountRow.c === 0
        ? 0
        : Math.round((accCountRow.c / reqCountRow.c) * 100);

      return {
        submittedPercent,
        pendingPercent: 100 - submittedPercent,
        pendingCount: pendingRow.c,
        haltedCount: haltedRow.c,
        acceptedCount: acceptedRow.c,
      };
    },

    programBudgetSummary: async (_, args, ctx) => {
      const [programs] = ctx.user?.role === 'staff'
        ? await db.execute(`SELECT * FROM programs WHERE user_id = ?`, [ctx.user.id])
        : await db.execute(`SELECT * FROM programs`);

      if (!args.programId) {
        return { usedPercent: null, balancePercent: null, budget: null, used: null, programs };
      }

      const [[program]] = await db.execute(`SELECT * FROM programs WHERE id = ?`, [args.programId]);
      if (!program) throw new Error('Program not found');

      const totalBudget = program.third_budget ?? program.second_budget ?? program.budget_amount;
      if (totalBudget == null) {
        return { usedPercent: null, balancePercent: null, budget: null, used: null, programs };
      }

      const [[usedRow]] = await db.execute(
        `SELECT SUM(acc.total_accounted_amount) as total_used
         FROM accountability_records acc
         JOIN requisitions req ON req.id = acc.requisition_id
         JOIN program_activities act ON act.id = req.activity_id
         JOIN program_outputs o ON o.id = act.output_id
         JOIN program_outcomes oc ON oc.id = o.outcome_id
         WHERE oc.program_id = ?`,
        [args.programId] 
      );

      const totalUsed = Number(usedRow.total_used ?? 0);
      const remaining = totalBudget - totalUsed;

      return {
        usedPercent: Math.round((totalUsed / totalBudget) * 100),
        balancePercent: Math.round((remaining / totalBudget) * 100),
        budget: totalBudget,
        used: totalUsed,
        programs,
      };
    },

    yearExpense: async (_, args) => {
      const [rows] = await db.execute(
        `SELECT MONTH(created_at) as month, SUM(total_requested_amount) as total_amount
         FROM requisitions
         WHERE YEAR(created_at) = ?
         GROUP BY MONTH(created_at)
         ORDER BY month`,
        [args.year]
      );
      return rows.map((r) => ({ month: r.month, totalAmount: r.total_amount }));
    },

    budgetComparisonData: async (_, args, ctx) => {
      const [programs] = ctx.user?.role === 'staff'
        ? await db.execute(`SELECT * FROM programs WHERE user_id = ?`, [ctx.user.id])
        : await db.execute(`SELECT * FROM programs`);

      if (!args.programId) return { chartData: [], programs };

      const [rows] = await db.execute(
        `SELECT
           act.name as activity_name,
           o.name as output_name,
           oc.name as outcome_name,
           act.budget as budget,
           SUM(acc.total_accounted_amount) as amount_used
         FROM program_activities act
         JOIN program_outputs o ON o.id = act.output_id
         JOIN program_outcomes oc ON oc.id = o.outcome_id
         JOIN programs p ON p.id = oc.program_id
         LEFT JOIN requisitions req ON req.activity_id = act.id
         LEFT JOIN accountability_records acc ON acc.requisition_id = req.id
         WHERE p.id = ?
         GROUP BY act.id, act.name, o.name, oc.name, act.budget`,
        [args.programId]
      );

      return {
        chartData: rows.map((r) => ({
          activityName: r.activity_name,
          outputName: r.output_name,
          outcomeName: r.outcome_name,
          budget: r.budget,
          amountUsed: r.amount_used ?? 0,
        })),
        programs,
      };
    },

    budgetUtilization: async () => {
      const [rows] = await db.execute(
        `SELECT
           act.name as activity_name, act.budget as activity_budget,
           o.name as output_name, o.budget as output_budget,
           oc.name as outcome_name, oc.budget as outcome_budget,
           p.name as program_name, p.budget as program_budget
         FROM program_activities act
         JOIN program_outputs o ON o.id = act.output_id
         JOIN program_outcomes oc ON oc.id = o.outcome_id
         JOIN programs p ON p.id = oc.program_id`
      );

      const nodes = new Map();

      for (const r of rows) {
        if (!nodes.has(r.activity_name)) {
          nodes.set(r.activity_name, {
            name: r.activity_name,
            utilization: pct(r.activity_budget, r.output_budget),
            budgetAmount: r.activity_budget,
            parentBudget: r.output_budget,
            level: 1,
          });
        }
        if (!nodes.has(r.output_name)) {
          nodes.set(r.output_name, {
            name: r.output_name,
            utilization: pct(r.output_budget, r.outcome_budget),
            budgetAmount: r.output_budget,
            parentBudget: r.outcome_budget,
            level: 2,
          });
        }
        if (!nodes.has(r.outcome_name)) {
          nodes.set(r.outcome_name, {
            name: r.outcome_name,
            utilization: pct(r.outcome_budget, r.program_budget),
            budgetAmount: r.outcome_budget,
            parentBudget: r.program_budget,
            level: 3,
          });
        }
        if (!nodes.has(r.program_name)) {
          nodes.set(r.program_name, {
            name: r.program_name,
            utilization: 1,
            budgetAmount: r.program_budget,
            parentBudget: r.program_budget,
            level: 4,
          });
        }
      }

      return Array.from(nodes.values());
    },

    programHierarchy: async (_, args) => {
      const [rows] = await db.execute(
        `SELECT
           act.name as activity_name, act.budget as activity_budget,
           o.name as output_name, o.budget as output_budget,
           oc.name as outcome_name, oc.budget as outcome_budget,
           p.name as program_name, p.budget as program_budget
         FROM program_activities act
         JOIN program_outputs o ON o.id = act.output_id
         JOIN program_outcomes oc ON oc.id = o.outcome_id
         JOIN programs p ON p.id = oc.program_id
         WHERE p.id = ?`,
        [args.programId]
      );

      if (rows.length === 0) {
        throw new Error('Program not found or has no budget hierarchy');
      }

      const outcomes = new Map();

      for (const r of rows) {
        if (!outcomes.has(r.outcome_name)) {
          outcomes.set(r.outcome_name, {
            name: r.outcome_name,
            budgetAmount: r.outcome_budget,
            utilization: pct(r.outcome_budget, r.program_budget),
            outputs: new Map(),
          });
        }
        const outcome = outcomes.get(r.outcome_name);

        if (!outcome.outputs.has(r.output_name)) {
          outcome.outputs.set(r.output_name, {
            name: r.output_name,
            budgetAmount: r.output_budget,
            utilization: pct(r.output_budget, r.outcome_budget),
            activities: [],
          });
        }
        outcome.outputs.get(r.output_name).activities.push({
          name: r.activity_name,
          budgetAmount: r.activity_budget,
          utilization: pct(r.activity_budget, r.output_budget),
        });
      }

      return {
        programName: rows[0].program_name,
        programBudget: rows[0].program_budget,
        outcomes: Array.from(outcomes.values()).map((oc) => ({
          ...oc,
          outputs: Array.from(oc.outputs.values()),
        })),
      };
    },

    accountabilityHighlights: async (_, args) => {
      const limit = args.limit ?? 5;

      const [[totalRow]] = await db.execute(
        `SELECT SUM(total_accounted_amount) as total FROM accountability_records`
      );
      const totalAccountedAmount = Number(totalRow.total ?? 0);

      const thisMonth = monthRange();
      const lastMonthDate = new Date(thisMonth.start);
      lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
      const lastMonth = monthRange(lastMonthDate);

      const [[thisMonthRow]] = await db.execute(
        `SELECT SUM(total_accounted_amount) as total FROM accountability_records WHERE created_at >= ? AND created_at < ?`,
        [thisMonth.start, thisMonth.end]
      );
      const [[lastMonthRow]] = await db.execute(
        `SELECT SUM(total_accounted_amount) as total FROM accountability_records WHERE created_at >= ? AND created_at < ?`,
        [lastMonth.start, lastMonth.end]
      );

      const thisMonthTotal = Number(thisMonthRow.total ?? 0);
      const lastMonthTotal = Number(lastMonthRow.total ?? 0);
      const percentChange = lastMonthTotal > 0
        ? Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 1000) / 10
        : null;

      const [[breakdownRow]] = await db.execute(
        `SELECT
          COUNT(*) as total,
          SUM(status = 'closed') as closed_count,
          SUM(status = 'halted') as halted_count,
          SUM(status IS NULL OR status NOT IN ('closed', 'halted')) as pending_count
        FROM accountability_records`
      );
      const breakdownTotal = breakdownRow.total || 1;
      const statusBreakdown = {
        closedPercent: Math.round(((breakdownRow.closed_count ?? 0) / breakdownTotal) * 1000) / 10,
        pendingPercent: Math.round(((breakdownRow.pending_count ?? 0) / breakdownTotal) * 1000) / 10,
        haltedPercent: Math.round(((breakdownRow.halted_count ?? 0) / breakdownTotal) * 1000) / 10,
      };

      const [recentRows] = await db.execute(
        `SELECT
          acc.id,
          req.requisition_no as requisition_no,
          acc.report_date as report_date,
          acc.total_accounted_amount as total_accounted_amount,
          req.total_requested_amount as assigned_amount
        FROM accountability_records acc
        JOIN requisitions req ON req.id = acc.requisition_id
        ORDER BY acc.created_at DESC
        LIMIT ?`,
        [limit]
      );

      const recent = recentRows.map((r) => {
        const totalAccounted = Number(r.total_accounted_amount ?? 0);
        const assigned = Number(r.assigned_amount ?? 0);
        return {
          id: r.id,
          requisitionNo: r.requisition_no,
          reportDate: r.report_date,
          totalAccountedAmount: totalAccounted,
          assignedAmount: assigned,
          varianceAmount: assigned - totalAccounted,
          overBudget: totalAccounted > assigned,
        };
      });

      return {
        totalAccountedAmount,
        totalAccountedAmountFormatted: formatAmount(totalAccountedAmount),
        percentChange,
        statusBreakdown,
        recent,
      };
    },
  },
};

export default dashboardResolvers;