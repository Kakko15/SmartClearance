require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

function generateSecurePassword() {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const special = "!@#$%&*";
  const all = upper + lower + digits + special;

  const required = [
    upper[crypto.randomInt(upper.length)],
    lower[crypto.randomInt(lower.length)],
    digits[crypto.randomInt(digits.length)],
    special[crypto.randomInt(special.length)],
  ];

  for (let i = 0; i < 12; i++) {
    required.push(all[crypto.randomInt(all.length)]);
  }

  for (let i = required.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [required[i], required[j]] = [required[j], required[i]];
  }

  return required.join("");
}

const accounts = [
  {
    name: "Super Admin",
    email: "superadmin@isu.edu.ph",
    role: "super_admin",
  },

  {
    name: "Department Chairman",
    email: "chairman@isu.edu.ph",
    role: "signatory",
    designation: "Department Chairman",
  },
  {
    name: "College Dean",
    email: "dean@isu.edu.ph",
    role: "signatory",
    designation: "College Dean",
  },
  {
    name: "Director Student Affairs",
    email: "dsa@isu.edu.ph",
    role: "signatory",
    designation: "Director of Student Affairs",
  },
  {
    name: "NSTP Director",
    email: "nstp@isu.edu.ph",
    role: "signatory",
    designation: "NSTP Director",
  },
  {
    name: "Executive Officer",
    email: "executive@isu.edu.ph",
    role: "signatory",
    designation: "Executive Officer",
  },
  {
    name: "Dean Graduate School",
    email: "gradschool@isu.edu.ph",
    role: "signatory",
    designation: "Dean of Graduate School",
  },

  {
    name: "Campus Librarian",
    email: "librarian@isu.edu.ph",
    role: "librarian",
  },
  {
    name: "Chief Accountant",
    email: "cashier@isu.edu.ph",
    role: "cashier",
  },
  {
    name: "Registrar",
    email: "registrar@isu.edu.ph",
    role: "registrar",
  },
];

const secretCodes = [
  {
    code: crypto.randomBytes(16).toString("hex"),
    role: "signatory",
    description: "Signatory signup code",
  },
  {
    code: crypto.randomBytes(16).toString("hex"),
    role: "librarian",
    description: "Librarian signup code",
  },
  {
    code: crypto.randomBytes(16).toString("hex"),
    role: "cashier",
    description: "Cashier signup code",
  },
  {
    code: crypto.randomBytes(16).toString("hex"),
    role: "registrar",
    description: "Registrar signup code",
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

  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const allExistingUsers = existingUsers?.users || [];

  for (const acct of accounts) {
    const existingUser = allExistingUsers.find(
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

      const profileData = {
        id: existingUser.id,
        full_name: acct.name,
        role: acct.role,
        account_enabled: true,
      };
      if (acct.designation) profileData.designation = acct.designation;

      const { error: profileError } = await supabase
        .from("profiles")
        .insert(profileData);

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

    const password = generateSecurePassword();

    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email: acct.email,
        password: password,
        email_confirm: true,
      });

    if (authError) {
      console.log(`  Auth failed for ${acct.name}: ${authError.message}`);
      failed++;
      continue;
    }

    const profileData = {
      id: authData.user.id,
      full_name: acct.name,
      role: acct.role,
      account_enabled: true,
    };
    if (acct.designation) profileData.designation = acct.designation;

    const { error: profileError } = await supabase
      .from("profiles")
      .insert(profileData);

    if (profileError) {
      console.log(`  Profile failed for ${acct.name}: ${profileError.message}`);

      await supabase.auth.admin.deleteUser(authData.user.id);
      failed++;
      continue;
    }

    console.log(
      `  Created: ${acct.name} (${acct.email}) - ${acct.role}${acct.designation ? ` [${acct.designation}]` : ""}`,
    );
    console.log(
      `           Password: ${password}`,
    );
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
    .select("id, full_name, role, designation")
    .order("role");

  if (allProfiles) {
    for (const p of allProfiles) {
      const desig = p.designation ? ` (${p.designation})` : "";
      console.log(`  ${p.role.padEnd(16)} | ${p.full_name}${desig}`);
    }
  }
}

createAccounts().catch(console.error);
