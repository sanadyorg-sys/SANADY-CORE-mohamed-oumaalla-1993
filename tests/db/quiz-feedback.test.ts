/**
 * Before passing, a learner's result gives the score only: not which
 * questions were right or wrong, nor the points per question, nor the
 * explanations — otherwise the next attempt is just flipping answers. People
 * following the learner still see the detail.
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

type Result = {
  passed: boolean;
  answers_revealed: boolean;
  details_shown: boolean;
  earned_points: number;
  questions: Array<{ is_correct: boolean | null; points_awarded: number | null; explanation: string | null; options: Array<Record<string, unknown>> }>;
};

const TRUE_FALSE = {
  modules: [{
    lessons: [{ kind: "pdf" as const, pages: 1 }],
    // Two options each, like true/false: knowing it is wrong gives the answer.
    questions: Array.from({ length: 4 }, () => ({ kind: "single" as const, options: [true, false] })),
  }],
};

describe("assessment feedback before passing", () => {
  it("shows the learner the score only, then everything once passed", async () => {
    const course = await buildCourse(db, admin, TRUE_FALSE);
    const mod = course.modules[0]!;
    await db.sql(`update public.questions set explanation = 'Parce que.' where quiz_id = $1`, [mod.quizId]);
    const teacher = await db.createUser(`tf.${uid()}@e.test`);
    await db.rpc(admin, "grant_course_to_user", [course.courseId, teacher]);
    await completeLessons(db, teacher, mod.lessonIds);

    // Attempt 1: two right, two wrong → failed.
    const s1 = await db.rpc<{ attempt_id: string }>(teacher, "start_quiz_attempt", [mod.quizId]);
    const failed = await db.rpc<Result>(teacher, "submit_quiz_attempt", [s1.attempt_id, JSON.stringify(answersFor(mod.questions, [true, true, false, false]))]);
    expect(failed.passed).toBe(false);
    expect(failed.earned_points).toBe(2);
    expect(failed.details_shown).toBe(false);
    for (const q of failed.questions) {
      expect(q.is_correct).toBeNull();
      expect(q.points_awarded).toBeNull();
      expect(q.explanation).toBeNull();
      expect("is_correct" in q.options[0]!).toBe(false);
    }
    expect((await db.rpc<Result>(teacher, "get_attempt_result", [s1.attempt_id])).questions.every((q) => q.is_correct === null)).toBe(true);

    // Nor by reading the graded answers directly.
    const direct = await db.as(teacher, (q) => q(`select is_correct from public.quiz_answers where attempt_id = $1`, [s1.attempt_id]));
    expect(direct).toHaveLength(0);

    // SANADY staff following the learner see the detail.
    const staffView = await db.rpc<Result>(admin, "get_attempt_result", [s1.attempt_id]);
    expect(staffView.questions.map((q) => q.is_correct)).toEqual([true, true, false, false]);
    expect((await db.as(admin, (q) => q(`select is_correct from public.quiz_answers where attempt_id = $1`, [s1.attempt_id]))).length).toBe(4);

    // Attempt 2 passes: answers, detail and explanations appear, for the earlier attempt too.
    const s2 = await db.rpc<{ attempt_id: string }>(teacher, "start_quiz_attempt", [mod.quizId]);
    const passed = await db.rpc<Result>(teacher, "submit_quiz_attempt", [s2.attempt_id, JSON.stringify(answersFor(mod.questions, [true, true, true, true]))]);
    expect(passed.passed).toBe(true);
    expect(passed.details_shown).toBe(true);
    expect(passed.questions.every((q) => q.is_correct === true && q.explanation === "Parce que.")).toBe(true);
    const earlier = await db.rpc<Result>(teacher, "get_attempt_result", [s1.attempt_id]);
    expect(earlier.questions.map((q) => q.is_correct)).toEqual([true, true, false, false]);
  });
});
