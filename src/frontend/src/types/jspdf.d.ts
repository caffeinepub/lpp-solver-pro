declare module "jspdf" {
  export class jsPDF {
    constructor(options?: {
      unit?: string;
      format?: string | number[];
      orientation?: string;
    });
    setFont(fontName: string, fontStyle?: string): jsPDF;
    setFontSize(size: number): jsPDF;
    setTextColor(r: number, g?: number, b?: number): jsPDF;
    setFillColor(r: number, g?: number, b?: number): jsPDF;
    setDrawColor(r: number, g?: number, b?: number): jsPDF;
    setLineWidth(width: number): jsPDF;
    text(
      text: string | string[],
      x: number,
      y: number,
      options?: Record<string, unknown>,
    ): jsPDF;
    rect(x: number, y: number, w: number, h: number, style?: string): jsPDF;
    line(x1: number, y1: number, x2: number, y2: number): jsPDF;
    addPage(): jsPDF;
    save(filename: string): jsPDF;
    getNumberOfPages(): number;
    setPage(page: number): jsPDF;
    saveGraphicsState(): jsPDF;
    restoreGraphicsState(): jsPDF;
    internal: {
      pageSize: { getWidth(): number; getHeight(): number };
      pages: unknown[];
    };
    GState(options: Record<string, unknown>): unknown;
    setGState(state: unknown): jsPDF;
    addFont(postScriptName: string, id: string, fontStyle: string): string;
    getFontList(): Record<string, string[]>;
    splitTextToSize(text: string, maxWidth: number): string[];
  }
}
