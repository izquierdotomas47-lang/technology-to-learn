'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeQuestionSet, toClientQuestion, gradeFromPercentage, getFreeQuestion, FREE_BANKS, RULES_VERSION } = require('../api/_lib/question-catalog');

const constantRandom = value => () => value;

test('server question catalogue preserves current practice ranges and operation arithmetic', () => {
    for (const level of [1, 2, 3]) {
        const questions = makeQuestionSet({ mode: 'practice', operation: 'add', level, total: 5, random: constantRandom(0.5) });
        assert.equal(questions.length, 5);
        for (const q of questions) {
            assert.equal(q.a + q.b, q.correctAnswer);
            assert.ok(q.a >= 1 && q.a <= [0, 10, 50, 150][level]);
            assert.ok(q.options.includes(q.correctOption));
            assert.equal(q.id.startsWith(`math-v${RULES_VERSION}-`), true);
        }
    }
});

test('assessment stays at twelve questions with three for each existing operation', () => {
    const questions = makeQuestionSet({ mode: 'assessment', operation: 'add', level: 2, total: 12, random: constantRandom(0.7) });
    assert.equal(questions.length, 12);
    assert.deepEqual(['add', 'subtract', 'multiply', 'divide'].map(op => questions.filter(q => q.operation === op).length), [3, 3, 3, 3]);
});

test('invalid activity, operation, level, and question count are rejected', () => {
    for (const params of [
        { mode: 'puzzle', operation: 'add', level: 1, total: 1 },
        { mode: 'practice', operation: 'other', level: 1, total: 1 },
        { mode: 'practice', operation: 'add', level: 4, total: 1 },
        { mode: 'practice', operation: 'add', level: 1, total: 0 },
        { mode: 'assessment', operation: 'add', level: 1, total: 11 }
    ]) assert.throws(() => makeQuestionSet(params), TypeError);
});

test('client-safe question omits all grading keys and current grade formula is preserved', () => {
    const [question] = makeQuestionSet({ mode: 'practice', operation: 'multiply', level: 1, total: 1, random: constantRandom(0.25) });
    const safe = toClientQuestion(question);
    assert.equal('correctAnswer' in safe, false);
    assert.equal('correctOption' in safe, false);
    assert.equal(gradeFromPercentage(0), 1);
    assert.equal(gradeFromPercentage(62.5), 3.5);
    assert.equal(gradeFromPercentage(100), 5);
});

test('free math banks preserve stable IDs, correct choices, and explanations', () => {
    for (const [category, bank] of Object.entries(FREE_BANKS)) {
        assert.ok(bank.length > 0);
        for (const item of bank) {
            assert.equal(typeof item[5], 'string');
            assert.equal(item[2].includes(item[1]), true);
            assert.equal(typeof item[6], 'string');
        }
        const selected = getFreeQuestion(category, [], () => 0);
        assert.equal(selected.exhausted, false);
        assert.equal(selected.question.id, bank[0][5]);
        assert.equal('correctAnswer' in selected.question, true);
        const safe = toClientQuestion(selected.question);
        assert.equal('correctAnswer' in safe, false);
        assert.equal('correctOption' in safe, false);
    }
});

test('free banks report exhaustion without silently resetting answered history', () => {
    const allAnswered = FREE_BANKS.puzzle.map(item => item[5]);
    assert.deepEqual(getFreeQuestion('puzzle', allAnswered), { exhausted: true, question: null });
    assert.throws(() => getFreeQuestion('english', []), TypeError);
});
