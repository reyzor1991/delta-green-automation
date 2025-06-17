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
    let htmlLabel = createHtmlLabel(label ?? "Sanity roll")

    let a = document.createElement("a");
    a.classList.add("inline-roll");
    a.appendChild(icon);
    a.appendChild(htmlLabel);
    a.dataset['checkType'] = 'sanity-roll';

    resultMap.forEach((value,key)=> {
        a.dataset[key] = value;
    })

    return a;
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

