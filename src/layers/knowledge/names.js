function nameTokens(name) {
    return String(name ?? "").toLowerCase().split(/\s+/).filter(Boolean);
}

function startsWithTokens(tokens, prefix) {
    return prefix.length <= tokens.length && prefix.every((token, i) => tokens[i] === token);
}

// Only a name can be completed: "Mona" -> "Mona Miller" is the point, but a
// subject like "the car" must never turn into "the car keys".
function looksLikeProperName(name) {
    return String(name).split(/\s+/).filter(Boolean).every((token) => /^\p{Lu}/u.test(token));
}

// The first spelling that is not all lowercase wins, and the pool lists the
// card names first, so "mona" gives way to how the card or an earlier entry
// wrote it.
function preferredSpelling(key, pool) {
    const spellings = pool.filter((name) => nameTokens(name).join(" ") === key);
    return spellings.find((name) => name !== name.toLowerCase()) ?? spellings[0];
}

// Case-insensitive, and completed to the one longer name it is the start of.
// Two such names ("Mona Miller", "Mona Smith") make a bare "Mona" ambiguous,
// so it is then left as it is rather than guessed.
export function resolveKnowledgeOwner(name, pool) {
    const tokens = nameTokens(name);
    if (tokens.length === 0) {
        return name;
    }

    const all = [...pool, name];
    const keys = [...new Set(all.map((entry) => nameTokens(entry).join(" ")).filter(Boolean))];
    const own = tokens.join(" ");
    const extensions = keys.filter((key) => key === own
        || (startsWithTokens(key.split(" "), tokens) && looksLikeProperName(preferredSpelling(key, all))));
    const longest = extensions.filter((key) =>
        !extensions.some((other) => other !== key && startsWithTokens(other.split(" "), key.split(" "))));

    return preferredSpelling(longest.length === 1 ? longest[0] : own, all);
}
