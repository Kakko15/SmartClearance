const crypto = require("crypto");
const supabase = require("../supabaseClient");
const {
  resolveUserEmail,
  sendEmail,
  createInAppNotification,
} = require("./notificationService");
const { escapeHtml } = require("../utils/escapeHtml");

const MAX_COMMENT_LENGTH = 2000;
const DEFAULT_DEADLINE_DAYS = 30;

async function logStatusChange(
  requestId,
  stage,
  oldStatus,
  newStatus,
  changedBy,
  comments,
) {
  try {
    await supabase.from("clearance_status_history").insert({
      request_id: requestId,
      stage,
      old_status: oldStatus,
      new_status: newStatus,
      changed_by: changedBy,
      comments: comments || null,
    });
  } catch (err) {
    console.warn("Status history log failed:", err.message);
  }
}

async function notifyStaffOfNewApplication(requestId, studentName, portion) {
  try {
    const roles = ["librarian", "cashier", "registrar", "signatory"];
    const { data: staff } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .in("role", roles)
      .eq("account_enabled", true);

    if (!staff || staff.length === 0) return;

    const subject = `New Graduation Clearance Application — ${escapeHtml(studentName)}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #22c55e;">SmartClearance</h1>
        <h2>New Clearance Application</h2>
        <p><strong>${escapeHtml(studentName)}</strong> has submitted a <strong>${escapeHtml(portion)}</strong> graduation clearance application.</p>
        <p>Please check your SmartClearance dashboard to review when it reaches your stage.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">SmartClearance — Isabela State University</p>
      </div>
    `;

    for (const member of staff) {
      const email = await resolveUserEmail(member.id);
      if (email) {
        sendEmail(member.id, requestId, email, subject, html).catch(() => {});
      }
    }
  } catch (err) {
    console.warn("Staff notification failed:", err.message);
  }
}

function generateCertificateNumber() {
  const year = new Date().getFullYear();
  const hex = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `ISU-GC-${year}-${hex}`;
}

async function snapshotApprovals(requestId) {
  const { data } = await supabase
    .from("professor_approvals")
    .select("id, status, comments, approved_at")
    .eq("request_id", requestId);
  return data || [];
}

async function restoreApprovals(requestId, snapshot) {
  const { data: current } = await supabase
    .from("professor_approvals")
    .select("id, status")
    .eq("request_id", requestId);

  if (!current) return;

  let restoredCount = 0;
  for (const prev of snapshot) {
    const now = current.find((c) => c.id === prev.id);

    if (now && prev.status !== "pending" && now.status === "pending") {
      restoredCount++;
      await supabase
        .from("professor_approvals")
        .update({
          status: prev.status,
          comments: prev.comments,
          approved_at: prev.approved_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", prev.id);
    }
  }

  if (restoredCount > 0) {
    console.warn(
      `[restoreApprovals] Restored ${restoredCount} approval(s) for request ${requestId} that were reset by a DB trigger.`,
    );
  }
}

async function healApprovals(approvals, requestId) {
  if (!approvals || approvals.length === 0) return approvals;

  const hasInconsistentStatus = approvals.some(
    (a) => a.status === "pending" && a.approved_at,
  );

  const hasPendingWithHistory =
    requestId && approvals.some((a) => a.status === "pending");

  if (!hasInconsistentStatus && !hasPendingWithHistory) {
    return approvals;
  }

  let healed = approvals.map((a) => {
    if (a.status === "pending" && a.approved_at) {
      return { ...a, status: "approved" };
    }
    return a;
  });

  const stillPending = healed.filter((a) => a.status === "pending");
  if (stillPending.length > 0 && requestId) {
    try {
      const { data: history } = await supabase
        .from("clearance_status_history")
        .select("changed_by, new_status")
        .eq("request_id", requestId)
        .eq("stage", "signatory")
        .eq("new_status", "approved");

      if (history && history.length > 0) {
        const approvedByIds = new Set(history.map((h) => h.changed_by));
        healed = healed.map((a) => {
          if (
            a.status === "pending" &&
            a.professor_id &&
            approvedByIds.has(a.professor_id)
          ) {
            return { ...a, status: "approved" };
          }
          return a;
        });
      }
    } catch (err) {
      console.warn("healApprovals: history lookup failed:", err.message);
    }
  }

  const healedIds = [];
  for (const h of healed) {
    const orig = approvals.find((a) => a.id === h.id);
    if (orig && orig.status === "pending" && h.status === "approved") {
      healedIds.push(h.id);
      try {
        await supabase
          .from("professor_approvals")
          .update({
            status: "approved",
            approved_at: h.approved_at || new Date().toISOString(),
          })
          .eq("id", h.id);
      } catch (writeErr) {
        console.warn(
          `healApprovals: DB write-back failed for ${h.id}:`,
          writeErr.message,
        );
      }
    }
  }

  if (healedIds.length > 0) {
    console.warn(
      `[healApprovals] Auto-healed ${healedIds.length} approval(s) for request ${requestId}: [${healedIds.join(", ")}]. This indicates a DB trigger is resetting statuses.`,
    );
  }

  return healed;
}

async function tryCompleteRequest(requestId) {
  try {
    const { data: request } = await supabase
      .from("requests")
      .select(
        "id, portion, library_status, cashier_status, registrar_status, is_completed",
      )
      .eq("id", requestId)
      .eq("is_completed", false)
      .single();

    if (!request) return;

    const { data: rawApprovals } = await supabase
      .from("professor_approvals")
      .select("status, approved_at, professor_id")
      .eq("request_id", requestId);

    const allApprovals = await healApprovals(rawApprovals || [], requestId);

    const allProfessorsApproved =
      allApprovals &&
      allApprovals.length > 0 &&
      allApprovals.every((a) => a.status === "approved");

    if (!allProfessorsApproved) return;

    const isUndergrad = request.portion === "undergraduate";

    const adminDone = isUndergrad
      ? request.library_status === "approved" &&
        request.cashier_status === "approved"
      : request.library_status === "approved" &&
        request.cashier_status === "approved" &&
        request.registrar_status === "approved";

    if (!adminDone) return;

    const preSnapshot = await snapshotApprovals(requestId);

    const certificateNumber = generateCertificateNumber();
    const now = new Date().toISOString();

    let updated;
    const { data: fullData, error: fullErr } = await supabase
      .from("requests")
      .update({
        is_completed: true,
        professors_status: "approved",
        certificate_generated: true,
        certificate_generated_at: now,
        certificate_number: certificateNumber,
        updated_at: now,
      })
      .eq("id", requestId)
      .eq("is_completed", false)
      .select()
      .single();

    if (fullErr) {

      const { data: fallbackData } = await supabase
        .from("requests")
        .update({
          is_completed: true,
          professors_status: "approved",
          updated_at: now,
        })
        .eq("id", requestId)
        .eq("is_completed", false)
        .select()
        .single();
      updated = fallbackData;
    } else {
      updated = fullData;
    }

    if (!updated) return;

    await restoreApprovals(requestId, preSnapshot);

    notifyClearanceStatusChange(requestId, "completed", "All Stages", null);
  } catch (err) {
    console.warn("tryCompleteRequest warning:", err.message);
  }
}

async function notifyClearanceStatusChange(
  requestId,
  status,
  stageName,
  comments,
) {
  try {
    const { data: request } = await supabase
      .from("requests")
      .select("student_id")
      .eq("id", requestId)
      .single();
    if (!request) return;

    const { data: student } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", request.student_id)
      .single();
    if (!student) return;

    const isCompleted = status === "completed";
    const isRejected = status === "rejected";

    const notifType = isCompleted ? "success" : isRejected ? "warning" : "info";
    const notifTitle = isCompleted
      ? "Graduation Clearance Completed!"
      : isRejected
        ? `Clearance On Hold — ${stageName}`
        : `${stageName} Stage Approved`;
    const notifMessage = isCompleted
      ? "Congratulations! Your graduation clearance is complete. Download your certificate now."
      : isRejected
        ? `Your clearance was placed on hold at the ${stageName} stage.${comments ? ` Reason: ${comments}` : ""}`
        : `Your graduation clearance has been approved at the ${stageName} stage.`;

    await createInAppNotification(
      request.student_id,
      notifType,
      notifTitle,
      notifMessage,
      requestId,
    );

    const email = await resolveUserEmail(request.student_id);
    if (!email) return;

    const subject = isCompleted
      ? "🎉 Graduation Clearance Completed!"
      : isRejected
        ? `Clearance On Hold — ${stageName}`
        : `Clearance Approved — ${stageName}`;

    const statusColor = isCompleted
      ? "#22c55e"
      : isRejected
        ? "#ef4444"
        : "#3b82f6";
    const statusLabel = isCompleted
      ? "Completed"
      : isRejected
        ? "On Hold"
        : "Approved";

    const html = `
      <p>Dear ${escapeHtml(student.full_name)},</p>
      <p>Your graduation clearance has been <strong style="color: ${statusColor};">${statusLabel}</strong> at the <strong>${escapeHtml(stageName)}</strong> stage.</p>
      ${comments ? `<p><strong>Comments:</strong> ${escapeHtml(comments)}</p>` : ""}
      ${isCompleted ? "<p>You can now download your graduation clearance certificate from the SmartClearance dashboard.</p>" : ""}
      ${isRejected ? "<p>Please check the comments and address any issues through your SmartClearance dashboard.</p>" : ""}
    `;

    await sendEmail(request.student_id, requestId, email, subject, html);
  } catch (error) {
    console.warn("Clearance notification failed:", error.message);
  }
}

module.exports = {
  MAX_COMMENT_LENGTH,
  DEFAULT_DEADLINE_DAYS,
  logStatusChange,
  notifyStaffOfNewApplication,
  generateCertificateNumber,
  snapshotApprovals,
  restoreApprovals,
  healApprovals,
  tryCompleteRequest,
  notifyClearanceStatusChange,
};
