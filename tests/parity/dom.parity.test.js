// DOM parity: the original app and the refactored build run side by side in two jsdom windows with
// the same clock, storage and user events. After every step of a scenario, their DOM, form values,
// focus, localStorage, console output and uncaught errors must be identical.
import { describe, expect, it } from 'vitest';
import { createApp } from '../harness/app-window.js';
import { diffSnapshots, takeSnapshot } from '../harness/snapshot.js';
import { SCENARIOS } from '../harness/scenarios.js';

async function runInLockstep(scenario) {
    const setup = await scenario.setup();
    const original = await createApp('legacy', setup);
    const refactored = await createApp('modern', setup);
    const compare = label => {
        // an uncaught error fails the step even when both apps throw the same one
        for (const app of [original, refactored]) {
            if (app.errors.length)
                throw new Error(`${app.kind} threw after "${label}": ${app.errors[0].stack || app.errors[0]}`);
        }
        const diff = diffSnapshots(takeSnapshot(original), takeSnapshot(refactored));
        if (diff) throw new Error(`after "${label}":\n${diff}`);
    };
    try {
        // the original really booted: sections rendered, skeleton gone
        expect(original.has('#appSkeleton')).toBe(false);
        expect(original.document.getElementById('daySelectorStrip').children.length).toBe(7);
        if (scenario.bootCheck) scenario.bootCheck(original, expect);
        compare('boot');
        for (const step of scenario.steps) {
            for (const app of [original, refactored]) {
                await step.run(app);
                await app.settle(step.settle);
            }
            // the step must actually have done what it says, in the original
            if (step.check) step.check(original, expect);
            compare(step.name);
        }
        return { original, refactored };
    } finally {
        original.close();
        refactored.close();
    }
}

describe('DOM parity with the original app', () => {
    it.each(SCENARIOS.map(s => [s.name, s]))('%s', async (_, scenario) => {
        await runInLockstep(scenario);
    });
});
