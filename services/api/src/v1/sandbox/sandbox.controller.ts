import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/v1/auth/guards/jwt.guard';
import { Roles } from '@/v1/auth/auth.decorator';
import { Role } from '@prisma/client';
import { AccountingSandboxService } from './accounting-sandbox.service';
import { GoldenScenarioProvider, GOLDEN_SCENARIOS } from './golden-scenarios.provider';
import {
  ListScenariosQuerySchema,
  SandboxGraphSchema,
  ValidateJournalDto,
  ValidateJournalSchema,
  type SandboxScenario,
} from './dto/sandbox.dto';

interface JournalLineInput {
  accountId: string;
  side: 'DEBIT' | 'CREDIT';
  amount: number;
}

@Controller('v1/sandbox')
@UseGuards(JwtAuthGuard)
export class SandboxController {
  constructor(
    private readonly sandbox: AccountingSandboxService,
    private readonly scenariosProvider: GoldenScenarioProvider,
  ) {}

  @Get('scenarios')
  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
  list(@Query() raw: unknown) {
    const { level, topicId } = ListScenariosQuerySchema.parse(raw);
    return this.scenariosProvider.list({ level, topicId });
  }

  @Get('graph')
  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
  graph() {
    const graph = this.scenariosProvider.getGraph();
    return SandboxGraphSchema.parse(graph);
  }

  @Post('journal/validate')
  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
  validate(@Body() raw: unknown) {
    const body = raw as { scenarioId?: string; entries?: unknown; lines?: unknown; description?: string };
    const parsed = ValidateJournalSchema.safeParse({
      entries: body.entries,
      lines: body.lines,
      description: body.description,
    });
    if (!parsed.success) {
      return {
        isBalanced: false,
        errors: parsed.error.issues.map((issue) => ({ code: 'VALIDATION', message: issue.message })),
      };
    }
    const dto = parsed.data;

    if (!dto.lines?.length && !dto.entries?.length) {
      return {
        isBalanced: false,
        errors: [{ code: 'JOURNAL_EMPTY', message: 'No lines or entries supplied' }],
      };
    }

    let lines: JournalLineInput[];
    if (dto.entries?.length) {
      lines = [];
      for (const entry of dto.entries) {
        lines.push({ accountId: entry.debitAccount, side: 'DEBIT', amount: entry.amount });
        lines.push({ accountId: entry.creditAccount, side: 'CREDIT', amount: entry.amount });
      }
    } else {
      lines = dto.lines ?? [];
    }

    const scenarioId = body.scenarioId;

    if (scenarioId) {
      const scenario = this.scenariosProvider.findById(scenarioId);
      if (!scenario) {
        return {
          isBalanced: false,
          score: 0,
          errors: [{ code: 'SCENARIO_NOT_FOUND', message: `Scenario ${scenarioId} not found` }],
        };
      }
      const errors = this.sandbox.validateJournal({
        attemptId: 'sandbox-validate',
        periodId: 'sandbox-validate',
        description: dto.description ?? 'validate',
        lines,
      });
      const expected = scenario.expectedLines;
      const isBalanced = errors.length === 0;
      const score = isBalanced ? computeMatchScore(lines, expected) : 0;
      return {
        isBalanced,
        score,
        errors,
        scenario: { id: scenario.id, title: scenario.title, level: scenario.level },
      };
    }

    const validation = this.sandbox.validateJournal({
      attemptId: 'sandbox-validate',
      periodId: 'sandbox-validate',
      description: dto.description ?? 'validate',
      lines,
    });
    return {
      isBalanced: validation.length === 0,
      errors: validation,
    };
  }
}

function computeMatchScore(actual: JournalLineInput[], expected: SandboxScenario['expectedLines']): number {
  if (expected.length === 0) return 1;
  const normalizedActual = new Set(actual.map((line) => `${line.accountId}:${line.side}:${line.amount}`));
  const normalizedExpected = new Set(
    expected.map((line) => `${line.accountId}:${line.side}:${line.amount}`),
  );
  let overlap = 0;
  for (const key of normalizedActual) if (normalizedExpected.has(key)) overlap += 1;
  return overlap / expected.length;
}