import { z } from "zod";
import type { GameType } from "../gametype.js";

/**
 * Radio theory quiz. The sender reads a question plus its options over radio;
 * the receiver records only the heard answer letter (A–D). Keeping it letter-
 * only means the correct answer (and option texts) never reach the trupp — they
 * live in the trupp-hidden payload. Options are shuffled per round so the right
 * letter differs between groups (anti-cheat). Auto scoring: correct letters.
 */

/** built-in question bank — each question has exactly 4 options; index 0 is correct. */
const BANK: { q: string; options: [string, string, string, string] }[] = [
  { q: "Was bedeutet das Funkwort ‚kommen‘ am Ende eines Spruchs?", options: ["Aufforderung zur Antwort", "Gespräch beendet", "Bitte lauter sprechen", "Standortwechsel"] },
  { q: "Wie spricht man die Ziffer 2 im Funk?", options: ["Zwo", "Zwei", "Doppel", "Zweier"] },
  { q: "Welche Meldungspriorität ist am höchsten?", options: ["Sofort", "Dringend", "Normal", "Routine"] },
  { q: "Notruf der Feuerwehr in Österreich?", options: ["122", "133", "144", "112"] },
  { q: "Euronotruf?", options: ["112", "911", "122", "999"] },
  { q: "Rettungsnotruf in Österreich?", options: ["144", "133", "122", "140"] },
  { q: "Polizeinotruf in Österreich?", options: ["133", "144", "122", "112"] },
  { q: "Was bedeutet die Bestätigung ‚verstanden‘?", options: ["Nachricht erhalten und verstanden", "Bitte wiederholen", "Ende der Übung", "Kanal wechseln"] },
  { q: "Buchstabe R im NATO-Alphabet?", options: ["Romeo", "Roger", "Radio", "Rom"] },
  { q: "Was prüft man vor dem Senden?", options: ["Ob der Kanal frei ist", "Die Uhrzeit", "Den Akkustand des Partners", "Die Antennenfarbe"] },
  { q: "Was tun bei schlechtem Empfang?", options: ["Langsamer und deutlicher sprechen", "Schreien", "Sofort auflegen", "Schneller sprechen"] },
  { q: "Was bedeutet das Funkwort ‚Ende‘?", options: ["Gespräch beendet, keine Antwort erwartet", "Kurze Pause", "Frage folgt", "Bitte buchstabieren"] },
];

export const quizConfigSchema = z.object({
  count: z.number().int().min(1).max(BANK.length).default(5),
});
export type QuizConfig = z.infer<typeof quizConfigSchema>;

export const quizPayloadSchema = z.object({
  questions: z.array(
    z.object({
      q: z.string(),
      options: z.array(z.string()),
      correctIndex: z.number().int(),
    }),
  ),
});
export type QuizPayload = z.infer<typeof quizPayloadSchema>;

export const quizAnswerSchema = z.object({ answers: z.array(z.number().int()) });
export type QuizAnswer = z.infer<typeof quizAnswerSchema>;

export const quiz: GameType<QuizConfig, QuizPayload, QuizAnswer> = {
  id: "quiz",
  label: "Funk-Theorie (Quiz)",
  verification: "auto",
  configSchema: quizConfigSchema,
  payloadSchema: quizPayloadSchema,
  answerSchema: quizAnswerSchema,

  generate(config, rng) {
    const picked = rng.shuffle(BANK).slice(0, Math.min(config.count, BANK.length));
    const questions = picked.map((item) => {
      const opts = item.options.map((text, idx) => ({ text, correct: idx === 0 }));
      const shuffled = rng.shuffle(opts);
      return {
        q: item.q,
        options: shuffled.map((o) => o.text),
        correctIndex: shuffled.findIndex((o) => o.correct),
      };
    });
    return { questions };
  },

  compare(payload, answer) {
    const total = payload.questions.length;
    let correct = 0;
    const perQuestion: boolean[] = [];
    payload.questions.forEach((q, i) => {
      const ok = answer.answers[i] === q.correctIndex;
      perQuestion.push(ok);
      if (ok) correct++;
    });
    return {
      accuracy: total === 0 ? 1 : correct / total,
      detail: { perQuestion, correct, total },
    };
  },

  samplePerfectAnswer(payload) {
    return { answers: payload.questions.map((q) => q.correctIndex) };
  },
};
