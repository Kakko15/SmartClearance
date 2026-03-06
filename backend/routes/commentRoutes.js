const express = require("express");
const router = express.Router();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

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
  return role && (role.includes("admin") || role === "super_admin");
};

const isProfessorRole = (role) => {
  return role && (role === "professor" || role === "department_head");
};

const filterByVisibility = (comments, userRole) => {
  return comments.filter((comment) => {
    if (comment.visibility === "all") return true;
    if (comment.visibility === "admins_only") return isAdminRole(userRole);
    if (comment.visibility === "professors_only")
      return isProfessorRole(userRole);
    return true;
  });
};

router.post("/:clearanceId/comments", async (req, res) => {
  try {
    const { clearanceId } = req.params;
    const { user_id, comment_text, visibility = "all" } = req.body;

    if (!user_id || !comment_text) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: user_id and comment_text",
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

router.get("/:clearanceId/comments", async (req, res) => {
  try {
    const { clearanceId } = req.params;
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: "Missing user_id query parameter",
      });
    }

    await getUserProfile(user_id);

    const { data: comments, error } = await supabase
      .from("clearance_comments")
      .select("*")
      .eq("clearance_request_id", clearanceId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      comments: comments || [],
    });
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.patch("/comments/:commentId/resolve", async (req, res) => {
  try {
    const { commentId } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: "Missing user_id",
      });
    }

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

    const isAuthor = comment.commenter_id === user_id;
    const isSuperAdmin = userProfile.role === "super_admin";
    const isRegistrar = userProfile.role === "registrar_admin";

    if (!isAuthor && !isSuperAdmin && !isRegistrar) {
      return res.status(403).json({
        success: false,
        error:
          "Unauthorized to resolve this comment. Only the author, Super Admin, or Registrar Admin can resolve comments.",
      });
    }

    const newResolvedState = !comment.is_resolved;

    const { data: updated, error: updateError } = await supabase
      .from("clearance_comments")
      .update({
        is_resolved: newResolvedState,
        resolved_by: newResolvedState ? user_id : null,
        resolved_at: newResolvedState ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", commentId)
      .select("*")
      .single();

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: newResolvedState
        ? "Comment marked as resolved"
        : "Comment marked as unresolved",
      comment: updated,
    });
  } catch (error) {
    console.error("Error resolving comment:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.delete("/comments/:commentId", async (req, res) => {
  try {
    const { commentId } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: "Missing user_id",
      });
    }

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

    const isAuthor = comment.commenter_id === user_id;
    const isSuperAdmin = userProfile.role === "super_admin";

    if (userProfile.role === "student") {
      return res.status(403).json({
        success: false,
        error: "Students cannot delete comments",
      });
    }

    if (!isAuthor && !isSuperAdmin) {
      return res.status(403).json({
        success: false,
        error:
          "Unauthorized to delete this comment. Only the author or Super Admin can delete.",
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

router.post("/create", async (req, res) => {
  try {
    const { request_id, user_id, comment_text } = req.body;

    if (!request_id || !user_id || !comment_text) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
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

router.get("/request/:request_id", async (req, res) => {
  try {
    const { request_id } = req.params;
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: "Missing user_id",
      });
    }

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

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: "Missing user_id",
      });
    }

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

    const isAuthor = comment.commenter_id === user_id;
    const isSuperAdmin = userProfile.role === "super_admin";

    if (!isAuthor && !isSuperAdmin) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized to delete this comment",
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
