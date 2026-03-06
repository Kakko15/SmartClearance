require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

const accounts = [
  {
    name: "Department Chairman",
    email: "chairman@isu.edu.ph",
    password: "Chairman123!",
    role: "professor",
  },
  {
    name: "College Dean",
    email: "dean@isu.edu.ph",
    password: "Dean123!",
    role: "professor",
  },
  {
    name: "Director Student Affairs",
    email: "dsa@isu.edu.ph",
    password: "DSA12345!",
    role: "professor",
  },
  {
    name: "NSTP Director",
    email: "nstp@isu.edu.ph",
    password: "NSTP12345!",
    role: "professor",
  },
  {
    name: "Executive Officer",
    email: "executive@isu.edu.ph",
    password: "Executive123!",
    role: "professor",
  },
  {
    name: "Dean Graduate School",
    email: "gradschool@isu.edu.ph",
    password: "GradDean123!",
    role: "professor",
  },

  {
    name: "Campus Librarian",
    email: "librarian@isu.edu.ph",
    password: "Library123!",
    role: "library_admin",
  },
  {
    name: "Chief Accountant",
    email: "cashier@isu.edu.ph",
    password: "Cashier123!",
    role: "cashier_admin",
  },
  {
    name: "Registrar",
    email: "registrar@isu.edu.ph",
    password: "Registrar123!",
    role: "registrar_admin",
  },
];

const secretCodes = [
  {
    code: "PROF-2024-SECRET",
    role: "professor",
    description: "Professor signup code",
  },
  {
    code: "PROF-SECRET-2024",
    role: "professor",
    description: "Professor signup code (alt)",
  },
  {
    code: "LIB-2024-SECRET",
    role: "library_admin",
    description: "Library admin signup code",
  },
  {
    code: "CASH-2024-SECRET",
    role: "cashier_admin",
    description: "Cashier admin signup code",
  },
  {
    code: "REG-2024-SECRET",
    role: "registrar_admin",
    description: "Registrar admin signup code",
  },
];

async function createAccounts() {
  console.log("=".repeat(60));
  console.log("ISU Clearance System - Bulk Account Creator");
  console.log("=".repeat(60));

  console.log("\nEnsuring secret codes exist...");
  for (const sc of secretCodes) {
    const { data: existing } = await supabase
      .from("admin_secret_codes")
      .select("id")
      .eq("code", sc.code)
      .eq("role", sc.role)
      .maybeSingle();

    if (!existing) {
      const { error } = await supabase.from("admin_secret_codes").insert({
        code: sc.code,
        role: sc.role,
        description: sc.description,
        is_active: true,
        max_uses: 100,
        current_uses: 0,
      });
      if (error) {
        console.log(`  Code ${sc.code} - insert failed: ${error.message}`);
      } else {
        console.log(`  Created code: ${sc.code} (${sc.role})`);
      }
    } else {
      console.log(`  ✓ Code exists: ${sc.code} (${sc.role})`);
    }
  }

  console.log("\nCreating accounts...");
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const acct of accounts) {
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email === acct.email,
    );

    if (existingUser) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", existingUser.id)
        .maybeSingle();

      if (profile) {
        console.log(
          `  ✓ Already exists: ${acct.name} (${acct.email}) - ${profile.role}`,
        );
        skipped++;
        continue;
      }

      const { error: profileError } = await supabase.from("profiles").insert({
        id: existingUser.id,
        full_name: acct.name,
        role: acct.role,
        account_enabled: true,
      });

      if (profileError) {
        console.log(
          `  Profile creation failed for ${acct.name}: ${profileError.message}`,
        );
        failed++;
      } else {
        console.log(
          `  Profile created for existing user: ${acct.name} (${acct.role})`,
        );
        created++;
      }
      continue;
    }

    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email: acct.email,
        password: acct.password,
        email_confirm: true,
      });

    if (authError) {
      console.log(`  Auth failed for ${acct.name}: ${authError.message}`);
      failed++;
      continue;
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: authData.user.id,
      full_name: acct.name,
      role: acct.role,
      account_enabled: true,
    });

    if (profileError) {
      console.log(
        `  Profile failed for ${acct.name}: ${profileError.message}`,
      );

      await supabase.auth.admin.deleteUser(authData.user.id);
      failed++;
      continue;
    }

    console.log(`  Created: ${acct.name} (${acct.email}) - ${acct.role}`);
    created++;
  }

  console.log("\n" + "=".repeat(60));
  console.log(
    `Results: ${created} created, ${skipped} already existed, ${failed} failed`,
  );
  console.log("=".repeat(60));

  console.log("\nAll accounts in system:");
  const { data: allProfiles } = await supabase
    .from("profiles")
    .select("id, full_name, role, email:id")
    .order("role");

  if (allProfiles) {
    for (const p of allProfiles) {
      console.log(`  ${p.role.padEnd(16)} | ${p.full_name}`);
    }
  }
}

createAccounts().catch(console.error);
