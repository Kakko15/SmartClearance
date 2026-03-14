import { useState, useEffect } from "react";
import { TrashIcon, EditIcon } from "../ui/Icons";

export default function CommentCard({
  comment,
  userId,
  userRole,
  onEdit,
  onDelete,
  isDarkMode = false,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.comment_text);
  const canDelete = () => {
    return comment.commenter_id === userId;
  };

  const canEdit = () => {
    return comment.commenter_id === userId;
  };

  const getRoleBadge = (role) => {
    const roleMap = {
      student: {
        label: "Student",
        bg: "bg-blue-100 text-blue-700 border-blue-200",
        darkBg: "bg-blue-900/30 text-blue-300 border-blue-700",
      },
      professor: {
        label: "Signatory",
        bg: "bg-purple-100 text-purple-700 border-purple-200",
        darkBg: "bg-purple-900/30 text-purple-300 border-purple-700",
      },
      signatory: {
        label: "Signatory",
        bg: "bg-purple-100 text-purple-700 border-purple-200",
        darkBg: "bg-purple-900/30 text-purple-300 border-purple-700",
      },
      department_head: {
        label: "Dept. Head",
        bg: "bg-purple-100 text-purple-700 border-purple-200",
        darkBg: "bg-purple-900/30 text-purple-300 border-purple-700",
      },
      library_admin: {
        label: "Librarian",
        bg: "bg-amber-100 text-amber-700 border-amber-200",
        darkBg: "bg-amber-900/30 text-amber-300 border-amber-700",
      },
      librarian: {
        label: "Librarian",
        bg: "bg-amber-100 text-amber-700 border-amber-200",
        darkBg: "bg-amber-900/30 text-amber-300 border-amber-700",
      },
      cashier_admin: {
        label: "Cashier",
        bg: "bg-emerald-100 text-emerald-700 border-emerald-200",
        darkBg: "bg-emerald-900/30 text-emerald-300 border-emerald-700",
      },
      cashier: {
        label: "Cashier",
        bg: "bg-emerald-100 text-emerald-700 border-emerald-200",
        darkBg: "bg-emerald-900/30 text-emerald-300 border-emerald-700",
      },
      registrar_admin: {
        label: "Registrar",
        bg: "bg-indigo-100 text-indigo-700 border-indigo-200",
        darkBg: "bg-indigo-900/30 text-indigo-300 border-indigo-700",
      },
      registrar: {
        label: "Registrar",
        bg: "bg-indigo-100 text-indigo-700 border-indigo-200",
        darkBg: "bg-indigo-900/30 text-indigo-300 border-indigo-700",
      },
      super_admin: {
        label: "Super Admin",
        bg: "bg-red-100 text-red-700 border-red-200",
        darkBg: "bg-red-900/30 text-red-300 border-red-700",
      },
    };
    const info = roleMap[role] || {
      label: role,
      bg: "bg-gray-100 text-gray-700 border-gray-200",
      darkBg: "bg-gray-800 text-gray-300 border-gray-600",
    };
    return (
      <span
        className={`text-xs px-2 py-0.5 rounded-full border font-medium ${isDarkMode ? info.darkBg : info.bg}`}
      >
        {info.label}
      </span>
    );
  };

  const getVisibilityBadge = () => {
    if (comment.visibility === "all") return null;
    const label =
      comment.visibility === "admins_only"
        ? "🔒 Admins Only"
        : "🎓 Professors Only";
    return (
      <span
        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          isDarkMode
            ? "bg-yellow-900/30 text-yellow-300 border border-yellow-700"
            : "bg-yellow-100 text-yellow-700 border border-yellow-200"
        }`}
      >
        {label}
      </span>
    );
  };

  return (
    <div
      className={`border-l-2 pl-4 py-3 transition-all ${
        isDarkMode
          ? "border-[#8ab4f8]"
          : "border-[#1a73e8]"
      }`}
    >
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center font-medium text-[15px] flex-shrink-0 ${
              isDarkMode ? "bg-[#8ab4f8]/20 text-[#8ab4f8]" : "bg-[#e8f0fe] text-[#1a73e8]"
            }`}
          >
            {comment.commenter_name?.charAt(0)?.toUpperCase() || "?"}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`font-medium text-[14px] leading-tight ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"}`}
                style={{ fontFamily: 'Google Sans, sans-serif' }}
              >
                {comment.commenter_name}
              </span>
              {getRoleBadge(comment.commenter_role)}
              {getVisibilityBadge()}
            </div>
            <span
              className={`text-[12px] leading-tight mt-0.5 block ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}
            >
              {new Date(comment.created_at).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {canEdit() && !isEditing && (
            <button
              onClick={() => {
                setEditText(comment.comment_text);
                setIsEditing(true);
              }}
              className={`p-1.5 rounded-full transition-colors flex items-center justify-center ${
                isDarkMode
                  ? "text-[#9aa0a6] hover:bg-[#3c4043] hover:text-[#e8eaed]"
                  : "text-[#5f6368] hover:bg-[#f1f3f4] hover:text-[#202124]"
              }`}
              title="Edit"
            >
              <EditIcon className="w-[18px] h-[18px]" />
            </button>
          )}

          {canDelete() && !isEditing && (
            <button
              onClick={() => onDelete(comment.id)}
              className={`p-1.5 rounded-full transition-colors flex items-center justify-center ${
                isDarkMode
                  ? "text-[#9aa0a6] hover:bg-[#5c1010]/30 hover:text-[#f28b82]"
                  : "text-[#5f6368] hover:bg-[#fce8e6] hover:text-[#c5221f]"
              }`}
              title="Delete"
            >
              <TrashIcon className="w-[18px] h-[18px]" />
            </button>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="mt-2 text-[14px]">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className={`w-full px-4 py-3 text-[14px] rounded-[16px] border focus:outline-none transition-shadow resize-none ${
              isDarkMode
                ? "bg-[#282a2d] border-[#3c4043] text-[#e8eaed] focus:shadow-[inset_0_0_0_1px_#8ab4f8]"
                : "bg-white border-[#dadce0] text-[#202124] focus:shadow-[inset_0_0_0_1px_#1a73e8]"
            }`}
            rows={2}
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => setIsEditing(false)}
              className={`text-[13px] px-4 py-1.5 rounded-full font-medium transition-colors ${
                isDarkMode
                  ? "text-[#9aa0a6] hover:bg-[#3c4043]"
                  : "text-[#5f6368] hover:bg-[#f1f3f4]"
              }`}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (editText.trim() && editText !== comment.comment_text) {
                  onEdit(comment.id, editText);
                }
                setIsEditing(false);
              }}
              disabled={!editText.trim() || editText === comment.comment_text}
              className={`text-[13px] px-4 py-1.5 rounded-full font-medium transition-colors ${
                isDarkMode
                  ? "bg-[#8ab4f8] text-[#202124] hover:bg-[#8ab4f8]/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  : "bg-[#1a73e8] text-white hover:bg-[#1a73e8]/90 disabled:opacity-50 disabled:cursor-not-allowed"
              }`}
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <p
          className={`text-[14px] mt-2 whitespace-pre-wrap leading-relaxed ${
            isDarkMode ? "text-[#e8eaed]" : "text-[#3c4043]"
          }`}
        >
          {comment.comment_text}
          {comment.updated_at && comment.updated_at !== comment.created_at && (
            <span
              className={`text-[11px] ml-2 italic ${
                isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"
              }`}
            >
              (edited)
            </span>
          )}
        </p>
      )}
    </div>
  );
}
