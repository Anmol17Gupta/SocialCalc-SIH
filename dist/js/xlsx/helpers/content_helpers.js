import { DEFAULT_FONT_SIZE } from "../../constants";
import { FIRST_NUMFMT_ID, HEIGHT_FACTOR, WIDTH_FACTOR, XLSX_FORMAT_MAP } from "../constants";
// -------------------------------------
//            CF HELPERS
// -------------------------------------
/**
 * Forces the first char of a string to lowerCase
 * e.g. BeginWith --> beginWith
 * */
export function convertOperator(operator) {
    return operator.charAt(0).toLowerCase() + operator.slice(1);
}
// -------------------------------------
//        WORKSHEET HELPERS
// -------------------------------------
export function getCellType(value) {
    switch (typeof value) {
        case "boolean":
            return "b";
        case "string":
            return "str";
        case "number":
            return "n";
    }
}
/**
 * For some reason, Excel will only take the devicePixelRatio (i.e. interface scale on Windows desktop)
 * into account for the height.
 */
export function convertHeight(height) {
    return Math.round(HEIGHT_FACTOR * height * window.devicePixelRatio * 100) / 100;
}
export function convertWidth(width) {
    return Math.round(WIDTH_FACTOR * width * 100) / 100;
}
export function extractStyle(cell, data) {
    let style = {};
    if (cell.style) {
        style = data.styles[cell.style];
    }
    const format = cell.format ? data.formats[cell.format] : undefined;
    let border = {};
    if (cell.border) {
        border = data.borders[cell.border];
    }
    const styles = {
        font: {
            size: (style === null || style === void 0 ? void 0 : style.fontSize) || DEFAULT_FONT_SIZE,
            color: (style === null || style === void 0 ? void 0 : style.textColor) ? style.textColor : "000000",
            family: 2,
            name: "Arial",
        },
        fill: (style === null || style === void 0 ? void 0 : style.fillColor)
            ? {
                fgColor: style.fillColor,
            }
            : { reservedAttribute: "none" },
        numFmt: format,
        border: border || {},
        verticalAlignment: "center",
        horizontalAlignment: style === null || style === void 0 ? void 0 : style.align,
    };
    styles.font["strike"] = !!(style === null || style === void 0 ? void 0 : style.strikethrough) || undefined;
    styles.font["underline"] = !!(style === null || style === void 0 ? void 0 : style.underline) || undefined;
    styles.font["bold"] = !!(style === null || style === void 0 ? void 0 : style.bold) || undefined;
    styles.font["italic"] = !!(style === null || style === void 0 ? void 0 : style.italic) || undefined;
    return styles;
}
export function normalizeStyle(construct, styles) {
    const { id: fontId } = pushElement(styles["font"], construct.fonts);
    const { id: fillId } = pushElement(styles["fill"], construct.fills);
    const { id: borderId } = pushElement(styles["border"], construct.borders);
    // Normalize this
    const numFmtId = convertFormat(styles["numFmt"], construct.numFmts);
    const style = {
        fontId,
        fillId,
        borderId,
        numFmtId,
        verticalAlignment: styles["verticalAlignment"],
        horizontalAlignment: styles["horizontalAlignment"],
    };
    const { id } = pushElement(style, construct.styles);
    return id;
}
export function convertFormat(format, numFmtStructure) {
    if (!format) {
        return 0;
    }
    let formatId = XLSX_FORMAT_MAP[format];
    if (!formatId) {
        const { id } = pushElement(format, numFmtStructure);
        formatId = id + FIRST_NUMFMT_ID;
    }
    return formatId;
}
/**
 * Add a relation to the given file and return its id.
 */
export function addRelsToFile(relsFiles, path, rel) {
    let relsFile = relsFiles.find((file) => file.path === path);
    // the id is a one-based int casted as string
    let id;
    if (!relsFile) {
        id = "rId1";
        relsFiles.push({ path, rels: [{ ...rel, id }] });
    }
    else {
        id = `rId${(relsFile.rels.length + 1).toString()}`;
        relsFile.rels.push({
            ...rel,
            id,
        });
    }
    return id;
}
export function pushElement(property, propertyList) {
    for (let [key, value] of Object.entries(propertyList)) {
        if (JSON.stringify(value) === JSON.stringify(property)) {
            return { id: parseInt(key, 10), list: propertyList };
        }
    }
    let elemId = propertyList.findIndex((elem) => JSON.stringify(elem) === JSON.stringify(property));
    if (elemId === -1) {
        propertyList.push(property);
        elemId = propertyList.length - 1;
    }
    return {
        id: elemId,
        list: propertyList,
    };
}
const chartIds = [];
/**
 * Convert a chart o-spreadsheet id to a xlsx id which
 * are unsigned integers (starting from 1).
 */
export function convertChartId(chartId) {
    const xlsxId = chartIds.findIndex((id) => id === chartId);
    if (xlsxId === -1) {
        chartIds.push(chartId);
        return chartIds.length;
    }
    return xlsxId + 1;
}
/**
 * Convert a value expressed in dot to EMU.
 * EMU = English Metrical Unit
 * There are 914400 EMU per inch.
 *
 * /!\ A value expressed in EMU cannot be fractional.
 * See https://docs.microsoft.com/en-us/windows/win32/vml/msdn-online-vml-units#other-units-of-measurement
 */
export function convertDotValueToEMU(value) {
    const DPI = 96;
    return Math.round((value * 914400) / DPI);
}
//# sourceMappingURL=content_helpers.js.map