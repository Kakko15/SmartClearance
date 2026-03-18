const supabase = require("../supabaseClient");

// Delete unverified accounts older than this threshold
const UNVERIFIED_ACCOUNT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Cleans up accounts where the user never verified their email.
 * Deletes both the auth.users entry and the profiles row.
 *
 * Runs periodically to prevent orphan accounts from accumulating
 * when users sign up with fake emails or abandon the signup flow.
 */
async function cleanupUnverifiedAccounts() {
  try {
    const cutoff = new Date(Date.now() - UNVERIFIED_ACCOUNT_MAX_AGE_MS).toISOString();

    // Find profiles created before the cutoff that belong to users
    // who never confirmed their email. We check auth.users via admin API.
    const { data: userList, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error("[Cleanup] Failed to list users:", listError.message);
      return;
    }

    const unverifiedUsers = userList.users.filter((user) => {
      return (
        !user.email_confirmed_at &&
        user.created_at &&
        new Date(user.created_at) < new Date(cutoff)
      );
    });

    if (unverifiedUsers.length === 0) return;

    console.log(`[Cleanup] Found ${unverifiedUsers.length} unverified account(s) older than 24h`);

    let deleted = 0;
    for (const user of unverifiedUsers) {
      try {
        // Delete profile row first (foreign key on id)
        await supabase.from("profiles").delete().eq("id", user.id);

        // Delete the auth user
        const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
        if (deleteError) {
          console.error(`[Cleanup] Failed to delete auth user ${user.id}:`, deleteError.message);
          continue;
        }

        deleted++;
      } catch (err) {
        console.error(`[Cleanup] Error cleaning up user ${user.id}:`, err.message);
      }
    }

    if (deleted > 0) {
      console.log(`[Cleanup] Deleted ${deleted} unverified account(s)`);
    }
  } catch (err) {
    console.error("[Cleanup] Unverified account cleanup failed:", err.message);
  }
}

module.exports = { cleanupUnverifiedAccounts };
