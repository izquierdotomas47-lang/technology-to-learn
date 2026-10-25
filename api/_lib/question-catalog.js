'use strict';

const RULES_VERSION = 1;
const OPERATIONS = Object.freeze(['add', 'subtract', 'multiply', 'divide']);
const QUESTION_TYPES = Object.freeze(['choice', 'visual', 'story', 'truefalse', 'input']);
const OPERATION_OBJECTS = Object.freeze({
    add: '⭐', subtract: '🚀', multiply: '🪐', divide: '🌙'
});

const FREE_BANKS = Object.freeze({
    puzzle: Object.freeze([
        ['Completa el patrón: 2, 4, 6, 8, ...', 10, [9, 10, 11, 12], 'add', '2 + 2 + 2 + 2 + 2', 'puzzle-pattern-2s-v1', 'El patrón aumenta de 2 en 2; después de 8 sigue 10.'],
        ['Tenías 14 estrellas y regalaste 5. ¿Cuántas quedan?', 9, [7, 8, 9, 10], 'subtract', '14 − 5', 'puzzle-stars-gift-v1', 'Al regalar 5 de las 14 estrellas, calculas 14 − 5 = 9.'],
        ['Tres cohetes llevan 4 estrellas cada uno. ¿Cuántas estrellas transportan?', 12, [8, 12, 16, 20], 'multiply', '3 × 4', 'puzzle-rockets-groups-v1', 'Tres grupos de 4 forman 3 × 4 = 12 estrellas.'],
        ['18 cristales se reparten entre 3 astronautas. ¿Cuántos recibe cada uno?', 6, [5, 6, 7, 9], 'divide', '18 ÷ 3', 'puzzle-crystals-share-v1', 'Al repartir 18 entre 3, cada astronauta recibe 6.'],
        ['¿Qué número sigue? 3, 6, 9, 12, ...', 15, [13, 14, 15, 18], 'add', '12 + 3', 'puzzle-pattern-3s-v1', 'La secuencia aumenta de 3 en 3: 12 + 3 = 15.'],
        ['Completa la secuencia: 5, 10, 15, ...', 20, [18, 20, 25, 30], 'add', '15 + 5', 'puzzle-pattern-5s-v1', 'La secuencia aumenta de 5 en 5: 15 + 5 = 20.'],
        ['La nave tenía 32 unidades de combustible y usó 14. ¿Cuántas quedan?', 18, [16, 18, 20, 22], 'subtract', '32 − 14', 'puzzle-fuel-used-v1', 'Restas las 14 unidades usadas: 32 − 14 = 18.'],
        ['Un planeta tiene 27 cráteres y otro 19. ¿Cuántos cráteres más tiene el primero?', 8, [6, 8, 9, 10], 'subtract', '27 − 19', 'puzzle-craters-difference-v1', 'La diferencia entre las cantidades es 27 − 19 = 8.'],
        ['Cada uno de 6 satélites tiene 4 paneles. ¿Cuántos paneles hay?', 24, [20, 22, 24, 28], 'multiply', '6 × 4', 'puzzle-satellite-panels-v1', 'Seis grupos de 4 paneles son 6 × 4 = 24.'],
        ['Hay 5 cajas con 7 rocas lunares en cada una. ¿Cuántas rocas hay?', 35, [30, 32, 35, 40], 'multiply', '5 × 7', 'puzzle-moon-boxes-v1', 'Cinco grupos de 7 rocas son 5 × 7 = 35.'],
        ['24 tanques pequeños se reparten por igual entre 6 módulos. ¿Cuántos recibe cada módulo?', 4, [3, 4, 5, 6], 'divide', '24 ÷ 6', 'puzzle-oxygen-share-v1', 'Al repartir 24 entre 6 módulos, cada uno recibe 4.'],
        ['Se guardan 36 estrellas en cajas de 9. ¿Cuántas cajas se llenan?', 4, [3, 4, 5, 6], 'divide', '36 ÷ 9', 'puzzle-stars-crates-v1', '36 dividido en cajas de 9 llena 4 cajas.']
    ]),
    'real-problem': Object.freeze([
        ['Compras 3 jugos de $2.000. ¿Cuánto pagas?', 6000, [4000, 5000, 6000, 8000], 'multiply', '3 × 2.000', 'real-juice-cost-v1', 'Tres jugos de $2.000 cuestan 3 × 2.000 = $6.000.'],
        ['Tienes $10.000 y gastas $3.500. ¿Cuánto queda?', 6500, [5500, 6000, 6500, 7000], 'subtract', '10.000 − 3.500', 'real-money-change-v1', 'El cambio es 10.000 − 3.500 = $6.500.'],
        ['12 galletas entre 4 personas. ¿Cuántas recibe cada una?', 3, [2, 3, 4, 6], 'divide', '12 ÷ 4', 'real-cookies-share-v1', '12 galletas entre 4 personas son 3 para cada una.'],
        ['Cada cuaderno cuesta $3.000. ¿Cuánto cuestan 4 cuadernos?', 12000, [9000, 11000, 12000, 14000], 'multiply', '4 × 3.000', 'real-notebooks-cost-v1', 'Cuatro cuadernos cuestan 4 × 3.000 = $12.000.'],
        ['En un bus hay 45 pasajeros. En una parada bajan 18. ¿Cuántos quedan?', 27, [23, 27, 33, 37], 'subtract', '45 − 18', 'real-bus-seats-v1', 'Quedan 45 − 18 = 27 pasajeros.'],
        ['Se empacan 32 manzanas por igual en 4 bolsas. ¿Cuántas van en cada bolsa?', 8, [6, 7, 8, 9], 'divide', '32 ÷ 4', 'real-apples-share-v1', '32 manzanas entre 4 bolsas son 8 por bolsa.'],
        ['Una caja trae 6 botellas. ¿Cuántas botellas hay en 5 cajas?', 30, [25, 28, 30, 35], 'multiply', '5 × 6', 'real-water-bottles-v1', 'Cinco cajas de 6 contienen 5 × 6 = 30 botellas.'],
        ['Tienes $20.000 y compras fruta por $8.500. ¿Cuánto dinero te queda?', 11500, [10500, 11500, 12500, 13500], 'subtract', '20.000 − 8.500', 'real-market-budget-v1', 'Después de comprar, quedan 20.000 − 8.500 = $11.500.'],
        ['Se reparten 42 tarjetas por igual entre 7 equipos. ¿Cuántas recibe cada equipo?', 6, [5, 6, 7, 8], 'divide', '42 ÷ 7', 'real-team-sharing-v1', '42 tarjetas entre 7 equipos son 6 para cada equipo.']
    ])
});

function getFreeQuestion(category, answeredIds = [], random = Math.random, filterOperation) {
    const bank = FREE_BANKS[category];
    if (!bank) throw new TypeError('Unknown question bank');
    if (filterOperation !== undefined && !OPERATIONS.includes(filterOperation)) throw new TypeError('Unknown operation');
    const answered = new Set(answeredIds);
    const available = bank.filter(item => !answered.has(item[5]) && (!filterOperation || item[3] === filterOperation));
    if (!available.length) return { exhausted: true, question: null };
    const item = available[Math.floor(random() * available.length)];
    const [prompt, correctAnswer, options, operation, expression, id, explanation] = item;
    return { exhausted: false, question: {
        id, category, prompt, correctAnswer, correctOption: correctAnswer,
        options, operation, expression, explanation
    } };
}

function integer(random, min, max) {
    return Math.floor(random() * (max - min + 1)) + min;
}

function makeQuestion(operation, level, index, random = Math.random) {
    if (!OPERATIONS.includes(operation) || !Number.isInteger(level) || level < 1 || level > 3) {
        throw new TypeError('Invalid question configuration');
    }
    const max = [0, 10, 50, 150][level];
    let a; let b; let answer; let text;
    if (operation === 'add') { a = integer(random, 1, max); b = integer(random, 1, max); answer = a + b; text = `${a} + ${b}`; }
    if (operation === 'subtract') { a = integer(random, 2, max); b = integer(random, 1, a); answer = a - b; text = `${a} − ${b}`; }
    if (operation === 'multiply') { const range = level === 1 ? 5 : 12; a = integer(random, 1, range); b = integer(random, 1, range); answer = a * b; text = `${a} × ${b}`; }
    if (operation === 'divide') { b = integer(random, 2, level === 1 ? 5 : 10); answer = integer(random, 1, level === 3 ? 20 : 10); a = b * answer; text = `${a} ÷ ${b}`; }

    const type = QUESTION_TYPES[index % QUESTION_TYPES.length];
    let claim;
    if (type === 'truefalse') claim = random() < 0.5 ? answer : answer + [-2, -1, 1, 2][integer(random, 0, 3)];
    const target = type === 'truefalse' ? Number(claim === answer) : answer;
    const values = new Set([target]);
    for (let attempts = 0; values.size < 4 && attempts < 30; attempts++) values.add(Math.max(0, target + integer(random, -8, 8)));
    for (let fallback = 0; values.size < 4 && fallback < 4; fallback++) values.add(target + fallback + 1);
    const options = type === 'truefalse' ? [0, 1] : [...values];
    // Shuffle with the same Fisher-Yates behavior used by the current UI.
    for (let i = options.length - 1; i > 0; i--) {
        const j = integer(random, 0, i);
        [options[i], options[j]] = [options[j], options[i]];
    }
    return Object.freeze({
        id: `math-v${RULES_VERSION}-${index + 1}`,
        operation, level, type, a, b, text, object: OPERATION_OBJECTS[operation],
        claim: type === 'truefalse' ? claim : null,
        correctAnswer: answer,
        correctOption: type === 'truefalse' ? target : answer,
        options: Object.freeze(options),
        prompt: type === 'truefalse' ? `¿Es verdadero que ${text} = ${claim}?` : text
    });
}

function makeQuestionSet({ mode, operation, level, total, random = Math.random }) {
    if (!['practice', 'assessment'].includes(mode)) throw new TypeError('Invalid activity');
    if (!OPERATIONS.includes(operation)) throw new TypeError('Invalid operation');
    if (!Number.isInteger(level) || level < 1 || level > 3) throw new TypeError('Invalid level');
    if (mode === 'assessment' && total !== 12) throw new TypeError('Invalid assessment question count');
    const count = mode === 'assessment' ? 12 : total;
    if (!Number.isInteger(count) || count < 1 || count > 50 || (mode === 'assessment' && count !== 12)) {
        throw new TypeError('Invalid question count');
    }
    return Array.from({ length: count }, (_, index) => {
        const questionOperation = mode === 'assessment' ? OPERATIONS[Math.floor(index / 3)] : operation;
        return makeQuestion(questionOperation, level, index, random);
    });
}

function toClientQuestion(question) {
    const { correctAnswer, correctOption, ...safe } = question;
    return safe;
}

function gradeFromPercentage(percentage) {
    // Matches the existing four-point percentage bands and one-decimal grade scale.
    const bounded = Math.min(100, Math.max(0, Number(percentage) || 0));
    return Math.min(5, Math.max(1, Math.round((1 + bounded * 0.04) * 10) / 10));
}

module.exports = { RULES_VERSION, OPERATIONS, QUESTION_TYPES, FREE_BANKS, getFreeQuestion, makeQuestionSet, toClientQuestion, gradeFromPercentage };
