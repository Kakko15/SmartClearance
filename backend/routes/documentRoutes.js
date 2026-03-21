const express = require("express");
const router = express.Router();
const supabase = require("../supabaseClient");
const upload = require("../middleware/uploadMiddleware");
const { requireAuth } = require("../middleware/authMiddleware");
const { safeErrorResponse } = require("../utils/safeError");
const { isStaffRole, isManagementRole } = require("../constants/roles");

router.post("/upload", requireAuth, upload.single("file"), async (req, res) => {
  try {
    const { request_id, user_id } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    if (!request_id || !user_id) {
      return res.status(400).json({
        success: false,
        error: "Missing request_id or user_id",
      });
    }

    if (req.user.id !== user_id) {
      return res.status(403).json({
        success: false,
        error: "User ID mismatch",
      });
    }

    const { data: request, error: reqError } = await supabase
      .from("requests")
      .select("*, profiles!requests_student_id_fkey(role)")
      .eq("id", request_id)
      .single();

    if (reqError || !request) {
      return res.status(404).json({
        success: false,
        error: "Request not found",
      });
    }

    const { data: userProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user_id)
      .single();

    const isOwner = request.student_id === user_id;
    const isAdmin =
      isStaffRole(userProfile?.role) || isManagementRole(userProfile?.role);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized to upload to this request",
      });
    }

    const timestamp = Date.now();
    const fileName = `${request_id}/${timestamp}-${file.originalname}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("request-documents")
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return res.status(500).json({
        success: false,
        error: "Failed to upload file",
      });
    }

    const { data: urlData } = supabase.storage
      .from("request-documents")
      .getPublicUrl(fileName);

    const { data: docData, error: docError } = await supabase
      .from("request_documents")
      .insert({
        request_id: request_id,
        uploaded_by: user_id,
        file_url: urlData.publicUrl,
        file_name: file.originalname,
        file_size: file.size,
        file_type: file.mimetype,
      })
      .select()
      .single();

    if (docError) {
      console.error("Database error:", docError);
      return res.status(500).json({
        success: false,
        error: "Failed to save document record",
      });
    }

    res.json({
      success: true,
      document: docData,
    });
  } catch (error) {
    console.error("Upload error:", error);
    safeErrorResponse(res, error);
  }
});

router.get("/request/:request_id", requireAuth, async (req, res) => {
  try {
    const { request_id } = req.params;
    const user_id = req.user.id;

    const { data: request } = await supabase
      .from("requests")
      .select("student_id")
      .eq("id", request_id)
      .single();

    if (!request) {
      return res.status(404).json({
        success: false,
        error: "Request not found",
      });
    }

    const { data: userProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user_id)
      .single();

    const isOwner = request.student_id === user_id;
    const isAdmin =
      isStaffRole(userProfile?.role) || isManagementRole(userProfile?.role);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized to view these documents",
      });
    }

    const { data: documents, error } = await supabase
      .from("request_documents")
      .select("*, profiles!request_documents_uploaded_by_fkey(full_name, role)")
      .eq("request_id", request_id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      documents: documents || [],
    });
  } catch (error) {
    console.error("Error fetching documents:", error);
    safeErrorResponse(res, error);
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    const { data: document, error: docError } = await supabase
      .from("request_documents")
      .select("*")
      .eq("id", id)
      .single();

    if (docError || !document) {
      return res.status(404).json({
        success: false,
        error: "Document not found",
      });
    }

    const { data: userProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user_id)
      .single();

    const isUploader = document.uploaded_by === user_id;
    const isAdmin =
      isStaffRole(userProfile?.role) || isManagementRole(userProfile?.role);

    if (!isUploader && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized to delete this document",
      });
    }

    const urlParts = document.file_url.split("/request-documents/");
    const filePath = urlParts[1];

    const { error: storageError } = await supabase.storage
      .from("request-documents")
      .remove([filePath]);

    if (storageError) {
      console.error("Storage deletion error:", storageError);
    }

    const { error: deleteError } = await supabase
      .from("request_documents")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    res.json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    console.error("Delete error:", error);
    safeErrorResponse(res, error);
  }
});

module.exports = router;
