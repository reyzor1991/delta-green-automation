import {localize} from "./utils.js";

function getSanityLabel(label: string, source?: string) {
    return label ?? (
        source === 'violence' ? "Violence Sanity roll"
            : source === 'helplessness' ? "Helplessness Sanity roll"
                : "Sanity roll"
    )
}

function getSkillLabel(label: string, source: string) {
    if (label) {
        return label
    }
    let locKey = 'DG.Skills.' + source;
    let localizedSource = localize(locKey);
    return localizedSource === locKey ? source.titleCase() : localizedSource;
}

function addPostIcon(a: HTMLElement, options: {}) {
    if (options?.relativeTo?.type !== 'text') {
        return
    }

    a.append(foundry.utils.parseHTML(`<span data-post-inline><i class="fa fa-comment" ></i></span>`));
}

export async function enrichSanityString(
    data: RegExpMatchArray,
    options: {},
): Promise<HTMLElement | null> {
    if (data.length < 4) {
        return null;
    }
    const [_match, _sanityType, rollParams, label] = data;

    const resultMap = new Map(
        rollParams.split(',').map(pair => {
            const [key, value] = pair.split(':');
            return [key.trim(), value.trim()];
        })
    );
    if (!resultMap.has('failure') || !resultMap.has('success')) {
        return null
    }

    let icon = createHtmlIcon("fa-brain");
    let htmlLabel = createHtmlLabel(getSanityLabel(label, resultMap.get("source")))

    let a = document.createElement("a");
    a.classList.add("inline-roll");
    a.appendChild(icon);
    a.appendChild(htmlLabel);
    a.dataset['checkType'] = 'sanity-roll';

    resultMap.forEach((value, key) => {
        a.dataset[key] = value;
    })

    addPostIcon(a, options);

    return a;
}

export async function enrichSkillString(
    data: RegExpMatchArray,
    options: {},
): Promise<HTMLElement | null> {
    if (data.length < 4) {
        return null;
    }
    const [_match, skillType, rollParams, label] = data;

    const resultMap = new Map(
        rollParams.split(',').map(pair => {
            const [key, value] = pair.split(':');
            return [key.trim(), value.trim()];
        })
    );
    if (!resultMap.has('key')) {
        return null
    }

    let icon = createHtmlIcon("fa-brain");
    let htmlLabel = createHtmlLabel(getSkillLabel(label, resultMap.get("key")))

    let a = document.createElement("a");
    a.classList.add("inline-roll");
    a.appendChild(icon);
    a.appendChild(htmlLabel);
    a.dataset['checkType'] = skillType === "Statistic" ? 'stat-roll' : 'skill-roll';
    a.dataset['key'] = resultMap.get("key");

    resultMap.forEach((value, key) => {
        a.dataset[key] = value;
    })

    addPostIcon(a, options);

    return a
}

function createHtmlIcon(iconStyle = "") {
    const icon = document.createElement("i");
    icon.classList.add('fa-solid', "icon", iconStyle);
    return icon;
}

function createHtmlLabel(text: string): HTMLElement {
    const span = document.createElement("span");
    span.classList.add("label");
    span.innerHTML = text;
    return span;
}

