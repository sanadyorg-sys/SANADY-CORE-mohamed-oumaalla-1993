/**
 * A learner who uses every attempt without passing gets a second set on its
 * own, seven minutes after the last submission, once per evaluation. Until
 * then, and after the second set, the evaluation stays exhausted and only an
 * administrator can reset it. Company courses with an approved assessment
 * policy keep their own limit.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, answersFor, buildCourse, completeLessons, uid } from "./harness";

let db: TestDb;
let admin: string;

beforeAll(async () => {
  db = await TestDb.create();
  admin = await db.createAdmin();
});
afterAll(async () => db?.close());

type Status = { attempts_used: number; remaining_attempts: number; exhausted: boolean; reissued: boolean };

const COURSE = {
  modules: [{ lessons: [{ kind: "pdf" as const, pages: 1 }], questions: Array.from({ length: 2 }, () => ({ kind: "single" as const, options: [true, false] })) }],
};

async function setup() {
  const course = await buildCourse(db, admin, COURSE);
  const mod = course.modules[0]!;
  const teacher = await db.createUser(`auto.${uid()}@e.test`);
  await db.rpc(admin, "grant_course_to_user", [course.courseId, teacher]);
  await completeLessons(db, teacher, mod.lessonIds);
  const fail = async () => {
    const s = await db.rpc<{ attempt_id: string }>(teacher, "start_quiz_attempt", [mod.quizId]);
    await db.rpc(teacher, "submit_quiz_attempt", [s.attempt_id, JSON.stringify(answersFor(mod.questions, [false, false]))]);
  };
  const status = () => db.rpc<Status>(teacher, "quiz_status", [mod.quizId]);
  /** Moves the learner's submissions back in time. */
  const age = (minutes: number) =>
    db.sql(`update public.quiz_attempts set submitted_at = submitted_at - make_interval(mins => $3) where quiz_id = $1 and user_id = $2 and voided_at is null`, [mod.quizId, teacher, minutes]);
  return { course, mod, teacher, fail, status, age };
}

describe("automatic second set of attempts", () => {
  it("hands out a new set seven minutes after the last failed attempt, once", async () => {
    const { mod, teacher, fail, status, age } = await setup();
    for (let i = 0; i < 3; i++) await fail();
    expect((await status()).exhausted).toBe(true);

    // Before seven minutes: still exhausted, nothing released.
    await age(5);
    expect(await db.rpc<number>(teacher, "release_due_quiz_attempts", [])).toBe(0);
    expect(await db.rpcError(teacher, "start_quiz_attempt", [mod.quizId])).toContain("attempts_exhausted");

    // After seven minutes: three new attempts, shown as a new set.
    await age(3);
    expect(await db.rpc<number>(teacher, "release_due_quiz_attempts", [])).toBe(3);
    const fresh = await status();
    expect(fresh).toMatchObject({ attempts_used: 0, remaining_attempts: 3, exhausted: false, reissued: true });

    // Recorded as automatic in the activity log, and in the learner's history.
    const audit = await db.sql<{ action: string; details: { learner_id: string } }>(
      `select action, details from public.audit_logs where action = 'quiz_attempts_auto_released' and entity_id = $1`, [mod.quizId]);
    expect(audit).toHaveLength(1);
    expect(audit[0]!.details.learner_id).toBe(teacher);

    // The second set runs out too: no third set, however long they wait.
    for (let i = 0; i < 3; i++) await fail();
    await age(60);
    expect(await db.rpc<number>(teacher, "release_due_quiz_attempts", [])).toBe(0);
    expect(await db.rpcError(teacher, "start_quiz_attempt", [mod.quizId])).toContain("attempts_exhausted");
    expect((await status()).exhausted).toBe(true);

    // An administrator can still reset it.
    await db.rpc(admin, "reset_quiz_attempts", [mod.quizId, teacher, "Accompagnement individuel"]);
    expect((await status()).remaining_attempts).toBe(3);
  });

  it("releases the set when the learner starts again, without visiting first", async () => {
    const { mod, fail, status, age, teacher } = await setup();
    for (let i = 0; i < 3; i++) await fail();
    await age(8);
    const s = await db.rpc<{ attempt_number: number }>(teacher, "start_quiz_attempt", [mod.quizId]);
    expect(s.attempt_number).toBe(1);
    expect((await status()).attempts_used).toBe(1);
  });

  it("leaves a passed evaluation and a learner with attempts left alone", async () => {
    const { mod, teacher, fail, age } = await setup();
    await fail();
    await age(30);
    expect(await db.rpc<number>(teacher, "release_due_quiz_attempts", [])).toBe(0);
    const s = await db.rpc<{ attempt_id: string }>(teacher, "start_quiz_attempt", [mod.quizId]);
    await db.rpc(teacher, "submit_quiz_attempt", [s.attempt_id, JSON.stringify(answersFor(mod.questions, [true, true]))]);
    await age(30);
    expect(await db.rpc<number>(teacher, "release_due_quiz_attempts", [])).toBe(0);
  });

  it("is not callable without a session", async () => {
    expect(await db.rpcError(null, "release_due_quiz_attempts", [], "anon")).toMatch(/permission denied/i);
  });
});
