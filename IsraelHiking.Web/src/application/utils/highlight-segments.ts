export type HighlightSegment = {
    text: string;
    isMatch: boolean;
};

function escapeRegExp(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function getHighlightSegments(value: string | null | undefined, searchTerm: string | null | undefined): HighlightSegment[] {
    const source = value ?? "";
    const trimmedSearchTerm = (searchTerm ?? "").trim();
    if (!source || !trimmedSearchTerm) {
        return [{ text: source, isMatch: false }];
    }

    const segments: HighlightSegment[] = [];
    const regex = new RegExp(escapeRegExp(trimmedSearchTerm), "gi");
    let lastIndex = 0;
    let match = regex.exec(source);

    while (match) {
        const start = match.index;
        const end = start + match[0].length;
        if (start > lastIndex) {
            segments.push({ text: source.substring(lastIndex, start), isMatch: false });
        }
        segments.push({ text: source.substring(start, end), isMatch: true });
        lastIndex = end;
        match = regex.exec(source);
    }

    if (lastIndex < source.length) {
        segments.push({ text: source.substring(lastIndex), isMatch: false });
    }
    return segments;
}
