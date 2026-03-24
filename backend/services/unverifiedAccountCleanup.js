const supabase = require("../supabaseClient");

const UNVERIFIED_ACCOUNT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

async function cleanupUnverifiedAccounts() {
  try {
    const cutoff = new Date(
      Date.now() - UNVERIFIED_ACCOUNT_MAX_AGE_MS,
    ).toISOString();

    // Fetch all users with pagination (Supabase defaults to 50 per page)
    let allUsers = [];
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data: userList, error: listError } =
        await supabase.auth.admin.listUsers({ page, perPage });

      if (listError) {
        console.error("[Cleanup] Failed to list users:", listError.message);
        return;
      }

      allUsers = allUsers.concat(userList.users);
      if (userList.users.length < perPage) break;
      page++;
    }

    const unverifiedUsers = allUsers.filter((user) => {
      return (
        !user.email_confirmed_at &&
        user.created_at &&
        new Date(user.created_at) < new Date(cutoff)
      );
    });

    if (unverifiedUsers.length === 0) return;

    console.log(
      `[Cleanup] Found ${unverifiedUsers.length} unverified account(s) older than 24h`,
    );

    let deleted = 0;
    for (const user of unverifiedUsers) {
      try {
        // Delete profile and related data first (before FK constraints)
        const { error: profileError } = await supabase
          .from("profiles")
          .delete()
          .eq("id", user.id);
        if (profileError) {
          console.warn(
            `[Cleanup] Profile cleanup failed for ${user.id}, skipping auth deletion:`,
            profileError.message,
          );
          continue;
        }

        const { error: deleteError } = await supabase.auth.admin.deleteUser(
          user.id,
        );
        if (deleteError) {
          console.error(
            `[Cleanup] Failed to delete auth user ${user.id}:`,
            deleteError.message,
          );
          continue;
        }

        deleted++;
      } catch (err) {
        console.error(
          `[Cleanup] Error cleaning up user ${user.id}:`,
          err.message,
        );
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
