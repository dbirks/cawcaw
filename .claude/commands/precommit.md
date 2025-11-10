---
description: Run code quality checks (biome + build) before committing
---

Please run comprehensive code quality checks to ensure the code is ready for commit:

1. Run `pnpm check` to check and fix any linting/formatting issues with Biome
2. Run `pnpm build` to verify TypeScript compilation and catch any type errors

If any checks fail, report the errors clearly. If all checks pass, confirm that the code is ready to commit.

Do NOT commit or push automatically - just run the checks and report results.
