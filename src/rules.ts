export const VALID_RULES_TYPES = [
    "targetModification"
];

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isNonEmptyArray<T>(value: unknown): value is T[] {
    return Array.isArray(value) && value.length > 0;
}

export function sum(values: []): number {
    return values.reduce((acc, val) => acc + val, 0);
}

export function sumMaxPositiveAndMostNegative(values: Set<number>): number {
    let maxPositive: number | null = null;
    let mostNegative: number | null = null;

    for (const value of values) {
        if (value > 0) {
            if (maxPositive === null || value > maxPositive) {
                maxPositive = value;
            }
        } else if (value < 0) {
            if (mostNegative === null || value < mostNegative) {
                mostNegative = value;
            }
        }
    }

    return (maxPositive ?? 0) + (mostNegative ?? 0);
}

export function isValidRules(rule: { type: string, value?: number, skill?: string, skills?: string[] }) {
    if (rule?.type === 'targetModification') {
        return (isNonEmptyString(rule?.skill) || isNonEmptyArray(rule?.skills)) && isPositiveInteger(rule?.value);
    }
    return false
}

export function applyRule(agent, rule: object) {
    if (rule?.type === 'targetModification') {
        handleTargetModification(agent, rule);
    }

}

function handleTargetModification(agent: Actor, rule: { value: number, skill?: string, skills?: string[] }): void {
    let value = rule.value;

    let skillForApplying = rule.skill
        ? [rule.skill]
        : (rule.skills || [])

    skillForApplying.forEach(s => {
        if (s in agent.system.skills) {
            agent.system.skills[s].modifications ??= []
            agent.system.skills[s].modifications.push(value);
        } else {
            console.warn(`Not found skill for rule in agent (${agent.uuid})`);
        }
    })
}