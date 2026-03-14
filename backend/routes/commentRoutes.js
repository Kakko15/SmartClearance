const express = require("express");
const router = express.Router();
const supabase = require("../supabaseClient");
const { requireAuth } = require("../middleware/authMiddleware");
const { isStaffRole, isManagementRole, ROLES } = require("../constants/roles");

const getUserProfile = async (userId) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", userId)
    .single();
  if (error) throw new Error("User not found");
  return data;
};

const isAdminRole = (role) => {
  return isStaffRole(role) || isManagementRole(role);
};

const isSignatoryRole = (role) => {
  return role === ROLES.SIGNATORY;
};

const filterByVisibility = (comments, userRole) => {
  return comments.filter((comment) => {
    if (comment.visibility === "all") return true;
    if (comment.visibility === "admins_only") return isAdminRole(userRole);
    if (comment.visibility === "professors_only")
      return isSignatoryRole(userRole);
    return true;
  });
};

router.post("/:clearanceId/comments", requireAuth, async (req, res) => {
  try {
    const { clearanceId } = req.params;
    const { user_id, comment_text, visibility = "all" } = req.body;

    if (!user_id || !comment_text) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: user_id and comment_text",
      });
    }

    // Verify the authenticated user matches the claimed user_id
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

    if (userProfile.role === "student") {
      return res.status(403).json({
        success: false,
        error:
          "Students cannot add comments. Comments are read-only for students.",
      });
    }

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
      const { notifyNewComment } = require("../services/notificationService");
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
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/:clearanceId/comments", requireAuth, async (req, res) => {
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
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.put("/comments/:commentId", requireAuth, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { user_id, comment_text } = req.body;

    if (!user_id || !comment_text) {
      return res.status(400).json({
        success: false,
        error: "Missing user_id or comment_text",
      });
    }

    // Verify the authenticated user matches the claimed user_id
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
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.delete("/comments/:commentId", requireAuth, async (req, res) => {
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

    if (user_id !== comment.commenter_id) {
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

    res.json({
      success: true,
      message: "Comment deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/create", requireAuth, async (req, res) => {
  try {
    const { request_id, user_id, comment_text } = req.body;

    if (!request_id || !user_id || !comment_text) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    // Verify the authenticated user matches the claimed user_id
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
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/request/:request_id", requireAuth, async (req, res) => {
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
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    const userProfile = await getUserProfile(user_id);

    const { data: comment, error: fetchError } = await supabase
      .from("clearance_comments")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !comment) {
      return res.status(404).json({
        success: false,
        error: "Comment not found",
      });
    }

    if (user_id !== comment.commenter_id) {
      return res.status(403).json({
        success: false,
        error: "You can only delete your own comments",
      });
    }

    const { error: deleteError } = await supabase
      .from("clearance_comments")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    res.json({
      success: true,
      message: "Comment deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting comment (legacy):", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
