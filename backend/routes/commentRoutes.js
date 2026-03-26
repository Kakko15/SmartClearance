const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const supabase = require("../supabaseClient");
const { requireAuth } = require("../middleware/authMiddleware");
const { safeErrorResponse } = require("../utils/safeError");
const { logAction, ACTIONS } = require("../services/auditService");
const {
  getUserProfile,
  isAdminRole,
  filterByVisibility,
} = require("../utils/commentHelpers");

let _notificationService = null;
function getNotificationService() {
  if (!_notificationService) {
    _notificationService = require("../services/notificationService");
  }
  return _notificationService;
}

const MAX_COMMENT_LENGTH = 2000;

const isDev = process.env.NODE_ENV !== "production";
const commentWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 200 : 30,
  message: { success: false, error: "Too many comment operations, please try again later" },
});

const commentReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 500 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests. Please try again later." },
});

router.post("/create", commentWriteLimiter, requireAuth, async (req, res) => {
  try {
    const { request_id, user_id, comment_text } = req.body;

    if (!request_id || !user_id || !comment_text) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    if (comment_text.length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({
        success: false,
        error: `Comment must be ${MAX_COMMENT_LENGTH} characters or fewer`,
      });
    }

    if (req.user.id !== user_id) {
      return res.status(403).json({
        success: false,
        error: "User ID mismatch",
      });
    }

    const userProfile = await getUserProfile(user_id);

    const { data: comment, error } = await supabase
      .from("clearance_comments")
      .insert({
        clearance_request_id: request_id,
        commenter_id: user_id,
        commenter_name: userProfile.full_name,
        commenter_role: userProfile.role,
        comment_text: comment_text.trim(),
        visibility: "all",
      })
      .select("*")
      .single();

    if (error) throw error;

    res.json({
      success: true,
      comment: {
        ...comment,
        user_id: comment.commenter_id,
        request_id: comment.clearance_request_id,
        profiles: {
          full_name: comment.commenter_name,
          role: comment.commenter_role,
        },
      },
    });
  } catch (error) {
    console.error("Error creating comment (legacy):", error);
    safeErrorResponse(res, error);
  }
});

router.get("/request/:request_id", commentReadLimiter, requireAuth, async (req, res) => {
  try {
    const { request_id } = req.params;
    const user_id = req.user.id;

    const userProfile = await getUserProfile(user_id);

    const { data: comments, error } = await supabase
      .from("clearance_comments")
      .select("*")
      .eq("clearance_request_id", request_id)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const filteredComments = filterByVisibility(
      comments || [],
      userProfile.role,
    );

    const legacyComments = filteredComments.map((c) => ({
      ...c,
      user_id: c.commenter_id,
      request_id: c.clearance_request_id,
      profiles: {
        full_name: c.commenter_name,
        role: c.commenter_role,
      },
    }));

    res.json({
      success: true,
      comments: legacyComments,
    });
  } catch (error) {
    console.error("Error fetching comments (legacy):", error);
    safeErrorResponse(res, error);
  }
});

router.post("/:clearanceId/comments", commentWriteLimiter, requireAuth, async (req, res) => {
  try {
    const { clearanceId } = req.params;
    const { user_id, comment_text, visibility = "all" } = req.body;

    if (!user_id || !comment_text) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: user_id and comment_text",
      });
    }

    if (comment_text.length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({
        success: false,
        error: `Comment must be ${MAX_COMMENT_LENGTH} characters or fewer`,
      });
    }

    if (req.user.id !== user_id) {
      return res.status(403).json({
        success: false,
        error: "User ID mismatch",
      });
    }

    const validVisibilities = ["all", "admins_only", "professors_only"];
    if (!validVisibilities.includes(visibility)) {
      return res.status(400).json({
        success: false,
        error:
          "Invalid visibility. Must be: all, admins_only, or professors_only",
      });
    }

    const userProfile = await getUserProfile(user_id);

    const { data: clearanceRequest, error: reqError } = await supabase
      .from("requests")
      .select("id, student_id")
      .eq("id", clearanceId)
      .single();

    if (reqError || !clearanceRequest) {
      return res.status(404).json({
        success: false,
        error: "Clearance request not found",
      });
    }

    const { data: comment, error: insertError } = await supabase
      .from("clearance_comments")
      .insert({
        clearance_request_id: clearanceId,
        commenter_id: user_id,
        commenter_name: userProfile.full_name,
        commenter_role: userProfile.role,
        comment_text: comment_text.trim(),
        visibility: visibility,
      })
      .select("*")
      .single();

    if (insertError) throw insertError;

    try {
      const { notifyNewComment } = getNotificationService();
      await notifyNewComment(clearanceId, user_id, comment_text);
    } catch (_notifError) {
      console.warn("Comment notification failed (non-blocking)");
    }

    res.json({
      success: true,
      comment: comment,
    });
  } catch (error) {
    console.error("Error creating comment:", error);
    safeErrorResponse(res, error);
  }
});

router.get("/:clearanceId/comments", commentReadLimiter, requireAuth, async (req, res) => {
  try {
    const { clearanceId } = req.params;
    const user_id = req.user.id;

    const userProfile = await getUserProfile(user_id);

    const { data: comments, error } = await supabase
      .from("clearance_comments")
      .select("*")
      .eq("clearance_request_id", clearanceId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const filtered = filterByVisibility(comments || [], userProfile.role);

    res.json({
      success: true,
      comments: filtered,
    });
  } catch (error) {
    console.error("Error fetching comments:", error);
    safeErrorResponse(res, error);
  }
});

router.put("/:commentId", commentWriteLimiter, requireAuth, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { user_id, comment_text } = req.body;

    if (!user_id || !comment_text) {
      return res.status(400).json({
        success: false,
        error: "Missing user_id or comment_text",
      });
    }

    if (comment_text.length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({
        success: false,
        error: `Comment must be ${MAX_COMMENT_LENGTH} characters or fewer`,
      });
    }

    if (req.user.id !== user_id) {
      return res.status(403).json({
        success: false,
        error: "User ID mismatch",
      });
    }

    const { data: comment, error: fetchError } = await supabase
      .from("clearance_comments")
      .select("*")
      .eq("id", commentId)
      .single();

    if (fetchError || !comment) {
      return res.status(404).json({
        success: false,
        error: "Comment not found",
      });
    }

    if (comment.commenter_id !== user_id) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized: Only the author can edit this comment.",
      });
    }

    const { data: updated, error: updateError } = await supabase
      .from("clearance_comments")
      .update({
        comment_text: comment_text.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", commentId)
      .select("*")
      .single();

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: "Comment updated successfully",
      comment: updated,
    });
  } catch (error) {
    console.error("Error updating comment:", error);
    safeErrorResponse(res, error);
  }
});

router.delete("/:commentId", commentWriteLimiter, requireAuth, async (req, res) => {
  try {
    const { commentId } = req.params;
    const user_id = req.user.id;

    const userProfile = await getUserProfile(user_id);

    const { data: comment, error: fetchError } = await supabase
      .from("clearance_comments")
      .select("*")
      .eq("id", commentId)
      .single();

    if (fetchError || !comment) {
      return res.status(404).json({
        success: false,
        error: "Comment not found",
      });
    }

    if (user_id !== comment.commenter_id && !isAdminRole(userProfile.role)) {
      return res.status(403).json({
        success: false,
        error: "You can only delete your own comments",
      });
    }

    const { error: deleteError } = await supabase
      .from("clearance_comments")
      .delete()
      .eq("id", commentId);

    if (deleteError) throw deleteError;

    if (user_id !== comment.commenter_id) {
      logAction(user_id, ACTIONS.COMMENT_DELETED_BY_ADMIN, {
        targetId: commentId,
        targetType: "clearance_comment",
        metadata: {
          originalAuthor: comment.commenter_id,
          requestId: comment.clearance_request_id,
        },
      });
    }

    res.json({
      success: true,
      message: "Comment deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting comment:", error);
    safeErrorResponse(res, error);
  }
});

module.exports = router;
