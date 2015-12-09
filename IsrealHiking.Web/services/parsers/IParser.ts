module IsraelHiking.Services.Parsers {
    export interface IParser {
        parse(content: string): Common.DataContainer;
        toString(data: Common.DataContainer): string;
    }
}  