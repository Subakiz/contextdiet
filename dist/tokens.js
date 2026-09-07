"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.countTokens = countTokens;
exports.calculateSavings = calculateSavings;
const js_tiktoken_1 = require("js-tiktoken");
const enc = (0, js_tiktoken_1.getEncoding)("cl100k_base");
function countTokens(text) {
    return enc.encode(text).length;
}
function calculateSavings(originalText, skeletonizedText) {
    const originalTokens = countTokens(originalText);
    const skeletonizedTokens = countTokens(skeletonizedText);
    const savings = originalTokens - skeletonizedTokens;
    const savingsPercentage = originalTokens > 0 ? (savings / originalTokens) * 100 : 0;
    return {
        originalTokens,
        skeletonizedTokens,
        savings,
        savingsPercentage
    };
}
