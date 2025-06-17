import {enrichSanityString} from "./enrichers.js";
import {clickInclineSanityRoll} from "./inline.js";
import {GlobalRolls} from "./const.js";

Hooks.on("init", () => {
    // Register custom enricher
    CONFIG.TextEditor.enrichers.push({
        pattern: /@(Sanity)\[([^\]]+)\](?:{([^}]+)})?/g,
        enricher: (match, options) => enrichSanityString(match, options),
    });

    GlobalRolls.DGPercentileRoll = CONFIG.Dice.rolls.find(c => c.name === 'DGPercentileRoll');

    let superClick = TextEditor._onClickInlineRoll;
    TextEditor._onClickInlineRoll = async function (event: MouseEvent) {
        const a = event.target?.closest("a.inline-roll");

        if (a?.dataset?.checkType) {
            event.preventDefault()
            let type = a.dataset.checkType;
            if (type === "sanity-roll") {
                clickInclineSanityRoll(event, {
                    success: a.dataset?.success,
                    failure: a.dataset?.failure,
                    source: a.dataset?.source,
                });
            } else {
                console.log(`unknown incline roll type: ${type}`);
            }
            return
        }
        superClick.call(this, event);
    }

})