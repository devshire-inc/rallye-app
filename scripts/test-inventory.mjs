#!/usr/bin/env node
// Deterministic test inventory by domain (BEAC-2088).
// Usage: bun run scripts/test-inventory.mjs <Domain> | --all

import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");
const SRC_DIR = join(REPO_ROOT, "src");

const DOMAIN_ORDER = [
  "Auth",
  "Agenda",
  "Alunos/Professores",
  "Turmas",
  "Perfil",
  "Financeiro",
  "Torneios",
];

// Directory prefixes are relative to src/, POSIX-style, no trailing slash.
// Files are exact paths relative to src/, POSIX-style.
const DOMAIN_RULES = {
  Auth: {
    dirs: ["pages/cadastro", "pages/VerifyEmail", "pages/VisitorRequest", "pages/VisitorVerify", "components/AuthLayout", "components/OtpInput", "components/TemporarySessionBanner"],
    files: [
      "pages/LoginPage.test.tsx",
      "pages/ForgotPassword.test.tsx",
      "pages/ResetPassword.test.tsx",
      "pages/CompletarCadastro.test.tsx",
      "pages/OAuthCallback.test.tsx",
      "components/SocialLoginButtons.test.tsx",
      "lib/oauth.test.ts",
      "lib/secureStorage.test.ts",
    ],
  },
  Agenda: {
    dirs: ["pages/Agenda", "components/AvailabilityGrid", "components/EnterArenaSheet", "components/WithdrawSheet", "components/TeacherBlockRequestButton"],
    files: [
      "pages/PendingApprovalsCard.test.tsx",
      "lib/api/availability.test.ts",
      "lib/api/bookings.test.ts",
      "lib/api/blockRequests.test.ts",
      "lib/api/pendingApprovals.test.ts",
      "lib/api/courts.test.ts",
    ],
  },
  "Alunos/Professores": {
    dirs: ["pages/Students", "pages/Teachers", "pages/Members"],
    files: ["lib/api/students.test.ts", "lib/api/teachers.test.ts", "lib/api/skillLevels.test.ts"],
  },
  Turmas: {
    dirs: ["pages/Turmas"],
    files: ["lib/api/classes.test.ts", "lib/api/classHistory.test.ts", "lib/api/enrollments.test.ts"],
  },
  Perfil: {
    dirs: ["pages/Profile", "pages/Settings", "pages/Roles", "pages/RoleAudit", "pages/Units", "pages/Notifications", "pages/ArenaSettings", "components/ThemeToggle"],
    files: [
      "context/PermissionsContext.test.tsx",
      "hooks/usePermission.test.tsx",
      "hooks/useTheme.test.tsx",
      "lib/api/me.test.ts",
      "lib/api/roles.test.ts",
      "lib/api/units.test.ts",
      "lib/api/unitSettings.test.ts",
      "lib/api/notificationPreferences.test.ts",
      "lib/api/notifications.test.ts",
      "lib/groupNotifications.test.ts",
      "lib/notificationRouting.test.ts",
      "lib/push.test.ts",
      "lib/tenantContext.test.ts",
      "lib/unitsLocalStore.test.ts",
    ],
  },
  Financeiro: {
    dirs: ["pages/Financeiro", "pages/Planos", "pages/DayUse", "pages/Reports"],
    files: [
      "lib/api/plans.test.ts",
      "lib/api/subscriptions.test.ts",
      "lib/api/earnings.test.ts",
      "lib/api/remuneration.test.ts",
      "lib/api/reports.test.ts",
      "lib/cashFlowAggregate.test.ts",
      "lib/dashboardTarget.test.ts",
      "lib/invoicePrefill.test.ts",
      "lib/invoiceStatus.test.ts",
      "lib/subscriptionPeriod.test.ts",
    ],
  },
  Torneios: {
    dirs: ["pages/Torneios", "pages/Tournaments", "pages/TournamentView", "pages/Bracket", "pages/MatchDetail", "pages/Rankings"],
    files: [
      "lib/api/tournaments.test.ts",
      "lib/api/tournamentBrackets.test.ts",
      "lib/api/tournamentWithdrawal.test.ts",
      "lib/api/rankings.test.ts",
      "lib/tournamentCountdown.test.ts",
      "hooks/useTournamentLive.test.ts",
    ],
  },
};

function toPosix(p) {
  return p.split(sep).join("/");
}

function walkTestFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      results.push(...walkTestFiles(full));
    } else if (/\.test\.(ts|tsx)$/.test(entry)) {
      results.push(full);
    }
  }
  return results;
}

function classify(relSrcPath) {
  for (const domain of DOMAIN_ORDER) {
    const rules = DOMAIN_RULES[domain];
    if (rules.files.includes(relSrcPath)) return domain;
    if (rules.dirs.some((d) => relSrcPath === d || relSrcPath.startsWith(d + "/"))) return domain;
  }
  return null;
}

function buildInventory() {
  const allFiles = walkTestFiles(SRC_DIR)
    .map((f) => toPosix(relative(REPO_ROOT, f)))
    .sort();

  const buckets = {};
  for (const domain of DOMAIN_ORDER) buckets[domain] = [];
  const unmapped = [];

  for (const file of allFiles) {
    const relSrc = file.startsWith("src/") ? file.slice(4) : file;
    const domain = classify(relSrc);
    if (domain) {
      buckets[domain].push(file);
    } else {
      unmapped.push(file);
    }
  }

  return { buckets, unmapped, total: allFiles.length };
}

function printDomain(domain, files) {
  console.log(`\n## ${domain} (${files.length})`);
  for (const f of files) console.log(`  ${f}`);
}

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: bun run scripts/test-inventory.mjs <Domain> | --all");
    console.error(`Domínios válidos: ${DOMAIN_ORDER.join(", ")}`);
    process.exit(1);
  }

  const { buckets, unmapped, total } = buildInventory();

  if (arg === "--all") {
    for (const domain of DOMAIN_ORDER) printDomain(domain, buckets[domain]);
    printDomain("Não mapeado", unmapped);
    console.log(`\nTotal de arquivos de teste: ${total}`);
    return;
  }

  if (!DOMAIN_ORDER.includes(arg)) {
    console.error(`Domínio desconhecido: ${arg}`);
    console.error(`Domínios válidos: ${DOMAIN_ORDER.join(", ")}`);
    process.exit(1);
  }

  printDomain(arg, buckets[arg]);
  console.log(`\nTotal no domínio ${arg}: ${buckets[arg].length}`);
}

main();
