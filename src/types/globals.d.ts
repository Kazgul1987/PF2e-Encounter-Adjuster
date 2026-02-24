declare function $(html: string): any;
declare function renderTemplate(path: string, data: any): Promise<string>;
declare function saveDataToFile(data: Blob, mimeType: string, filename: string): void;
declare function fromUuid(uuid: string): Promise<any>;
