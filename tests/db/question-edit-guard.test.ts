/**
 * Editing a question that teachers have already seen (open or submitted
 * attempt) must never change how their answers are graded or displayed:
 * wording can be corrected, but not the answers, the correct choice, the
 * type or the points. Unused questions stay freely editable.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, buildCourse, completeLessons, uid } from "./harness";

let db: TestDb;
let admin: string;

beforeAll(async () => {
  db = await TestDb.create();
  admin = await db.createAdmin();
});
afterAll(async () => db?.close());

type Started = { attempt_id: string };
type Opt = { id: string; correct: boolean };

const options = (opts: Array<{ id: string | null; label: string; is_correct: boolean }>) => JSON.stringify(opts);

async function courseWithAttempt({ submit }: { submit: boolean }) {
  const course = await buildCourse(db, admin, { modules: [{ lessons: [{ kind: "pdf" }], questions: [{ kind: "single", options: [true, false, false] }] }] });
  const mod = course.modules[0]!;
  const question = mod.questions[0]! as { id: string; options: Opt[] };
  const teacher = await db.createUser(`guard.${uid()}@e.test`);
  await db.rpc(admin, "grant_course_to_user", [course.courseId, teacher]);
  await completeLessons(db, teacher, mod.lessonIds);
  const started = await db.rpc<Started>(teacher, "start_quiz_attempt", [mod.quizId]);
  const correct = question.options.find((o) => o.correct)!;
  if (submit) {
    await db.rpc(teacher, "submit_quiz_attempt", [started.attempt_id, JSON.stringify({ [question.id]: [correct.id] })]);
  }
  return { quizId: mod.quizId, question, correct, teacher, attemptId: started.attempt_id };
}

const same = (q: { options: Opt[] }, label = (i: number) => `Réponse ${i + 1}`) =>
  q.options.map((o, i) => ({ id: o.id, label: label(i), is_correct: o.correct }));

describe("editing a question already answered", () => {
  it("refuses to change the correct answer, the answers, the type or the points", async () => {
    const { quizId, question } = await courseWithAttempt({ submit: true });
    const save = (kind: string, points: number, opts: string) =>
      db.rpcError(admin, "save_question", [quizId, question.id, kind, "Énoncé", "", points, opts]);

    // Another answer marked correct.
    const swapped = question.options.map((o, i) => ({ id: o.id, label: `R${i}`, is_correct: !o.correct && i === question.options.findIndex((x) => !x.correct) }));
    expect(await save("single", 1, options(swapped))).toMatch(/question_in_use/);
    // An answer removed.
    expect(await save("single", 1, options(same(question).slice(0, 2)))).toMatch(/question_in_use/);
    // An answer added.
    expect(await save("single", 1, options([...same(question), { id: null, label: "Nouvelle", is_correct: false }]))).toMatch(/question_in_use/);
    // Different type or points.
    expect(await save("multiple", 1, options(same(question)))).toMatch(/question_in_use/);
    expect(await save("single", 5, options(same(question)))).toMatch(/question_in_use/);
  });

  it("still allows correcting the wording, and the teacher's result is unchanged", async () => {
    const { quizId, question, correct, teacher, attemptId } = await courseWithAttempt({ submit: true });
    await db.rpc(admin, "save_question", [quizId, question.id, "single", "Énoncé corrigé", "Explication ajoutée", 1, options(same(question, (i) => `Libellé corrigé ${i}`))]);

    const [row] = await db.sql<{ label: string }>(`select label from public.question_options where id = $1`, [correct.id]);
    expect(row!.label).toMatch(/^Libellé corrigé/);
    const [attempt] = await db.sql<{ passed: boolean; score_percent: string }>(`select passed, score_percent from public.quiz_attempts where id = $1`, [attemptId]);
    expect(attempt!.passed).toBe(true);
    expect(Number(attempt!.score_percent)).toBe(100);
    expect(teacher).toBeTruthy();
  });

  it("protects a question shown in an attempt that is still open", async () => {
    const { quizId, question } = await courseWithAttempt({ submit: false });
    expect(await db.rpcError(admin, "save_question", [quizId, question.id, "single", "Énoncé", "", 1, options(same(question).slice(0, 2))])).toMatch(/question_in_use/);
  });

  it("leaves questions nobody has seen freely editable", async () => {
    const course = await buildCourse(db, admin, { modules: [{ lessons: [{ kind: "pdf" }], questions: [{ kind: "single", options: [true, false, false] }] }] }, { publish: false });
    const mod = course.modules[0]!;
    const question = mod.questions[0]! as { id: string; options: Opt[] };
    const id = await db.rpc<string>(admin, "save_question", [mod.quizId, question.id, "multiple", "Nouvel énoncé", "", 3, options([
      { id: question.options[0]!.id, label: "A", is_correct: true },
      { id: null, label: "B", is_correct: true },
    ])]);
    expect(id).toBe(question.id);
  });
});
