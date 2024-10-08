import { BACKGROUND_CHART_COLOR } from "../../src/constants";
import { isInside, lettersToNumber, toCartesian, toZone } from "../../src/helpers/index";
import { target } from "./helpers";
/**
 * Dispatch an UNDO to the model
 */
export function undo(model) {
    return model.dispatch("REQUEST_UNDO");
}
/**
 * Dispatch a REDO to the model
 */
export function redo(model) {
    return model.dispatch("REQUEST_REDO");
}
export function activateSheet(model, sheetIdTo, sheetIdFrom = model.getters.getActiveSheetId()) {
    return model.dispatch("ACTIVATE_SHEET", { sheetIdFrom, sheetIdTo });
}
/**
 * Create a new sheet. By default, the sheet is added at position 1
 * If data.activate is true, a "ACTIVATE_SHEET" is dispatched
 */
export function createSheet(model, data) {
    const sheetId = data.sheetId || model.uuidGenerator.uuidv4();
    const result = model.dispatch("CREATE_SHEET", {
        position: data.position !== undefined ? data.position : 1,
        sheetId,
        cols: data.cols,
        rows: data.rows,
    });
    if (data.activate) {
        activateSheet(model, sheetId);
    }
    return result;
}
export function renameSheet(model, sheetId, name) {
    return model.dispatch("RENAME_SHEET", { sheetId, name });
}
export function createSheetWithName(model, data, name) {
    let createResult = createSheet(model, data);
    if (!createResult.isSuccessful) {
        return createResult;
    }
    const sheets = model.getters.getSheets();
    return renameSheet(model, sheets[sheets.length - 1].id, name);
}
export function deleteSheet(model, sheetId) {
    return model.dispatch("DELETE_SHEET", { sheetId });
}
/**
 * Create a new chart by default of type bar with titles
 * in the data sets, on the active sheet.
 */
export function createChart(model, data, chartId, sheetId) {
    const id = chartId || model.uuidGenerator.uuidv4();
    sheetId = sheetId || model.getters.getActiveSheetId();
    return model.dispatch("CREATE_CHART", {
        id,
        sheetId,
        definition: {
            title: data.title || "test",
            dataSets: data.dataSets || [],
            dataSetsHaveTitle: data.dataSetsHaveTitle !== undefined ? data.dataSetsHaveTitle : true,
            labelRange: data.labelRange,
            type: data.type || "bar",
            background: data.background || BACKGROUND_CHART_COLOR,
            verticalAxisPosition: data.verticalAxisPosition || "left",
            legendPosition: data.legendPosition || "top",
            stackedBar: data.stackedBar || false,
        },
    });
}
/**
 * Update a chart
 */
export function updateChart(model, chartId, definition) {
    return model.dispatch("UPDATE_CHART", {
        id: chartId,
        definition,
    });
}
/**
 * Add columns
 */
export function addColumns(model, position, column, quantity, sheetId = model.getters.getActiveSheetId()) {
    return model.dispatch("ADD_COLUMNS_ROWS", {
        sheetId,
        dimension: "COL",
        position,
        base: lettersToNumber(column),
        quantity,
    });
}
/**
 * Delete columns
 */
export function deleteColumns(model, columns, sheetId = model.getters.getActiveSheetId()) {
    return model.dispatch("REMOVE_COLUMNS_ROWS", {
        sheetId,
        dimension: "COL",
        elements: columns.map(lettersToNumber),
    });
}
/**
 * Resize columns
 */
export function resizeColumns(model, columns, size, sheetId = model.getters.getActiveSheetId()) {
    return model.dispatch("RESIZE_COLUMNS_ROWS", {
        dimension: "COL",
        elements: columns.map(lettersToNumber),
        sheetId,
        size,
    });
}
/**
 * Add rows
 */
export function addRows(model, position, row, quantity, sheetId = model.getters.getActiveSheetId()) {
    return model.dispatch("ADD_COLUMNS_ROWS", {
        dimension: "ROW",
        sheetId,
        position,
        base: row,
        quantity,
    });
}
/**
 * Delete rows
 */
export function deleteRows(model, rows, sheetId = model.getters.getActiveSheetId()) {
    return model.dispatch("REMOVE_COLUMNS_ROWS", {
        sheetId,
        elements: rows,
        dimension: "ROW",
    });
}
/**
 * Resize rows
 */
export function resizeRows(model, rows, size, sheetId = model.getters.getActiveSheetId()) {
    return model.dispatch("RESIZE_COLUMNS_ROWS", {
        dimension: "ROW",
        elements: rows,
        sheetId,
        size,
    });
}
/**
 * Hide Columns
 */
export function hideColumns(model, columns, sheetId = model.getters.getActiveSheetId()) {
    return model.dispatch("HIDE_COLUMNS_ROWS", {
        sheetId,
        dimension: "COL",
        elements: columns.map(lettersToNumber),
    });
}
/**
 * Unhide Columns
 */
export function unhideColumns(model, columns, sheetId = model.getters.getActiveSheetId()) {
    return model.dispatch("UNHIDE_COLUMNS_ROWS", {
        sheetId,
        dimension: "COL",
        elements: columns.map(lettersToNumber),
    });
}
/**
 * Hide Rows
 */
export function hideRows(model, rows, sheetId = model.getters.getActiveSheetId()) {
    return model.dispatch("HIDE_COLUMNS_ROWS", {
        sheetId,
        dimension: "ROW",
        elements: rows,
    });
}
/**
 * Unhide Rows
 */
export function unhideRows(model, rows, sheetId = model.getters.getActiveSheetId()) {
    return model.dispatch("UNHIDE_COLUMNS_ROWS", {
        sheetId,
        dimension: "ROW",
        elements: rows,
    });
}
export function deleteCells(model, range, shift) {
    return model.dispatch("DELETE_CELL", {
        zone: toZone(range),
        shiftDimension: shift === "left" ? "COL" : "ROW",
    });
}
export function insertCells(model, range, shift) {
    return model.dispatch("INSERT_CELL", {
        zone: toZone(range),
        shiftDimension: shift === "right" ? "COL" : "ROW",
    });
}
/**
 * Set a border to a given zone or the selected zones
 */
export function setBorder(model, border, xc) {
    const target = xc ? [toZone(xc)] : model.getters.getSelectedZones();
    model.dispatch("SET_FORMATTING", {
        sheetId: model.getters.getActiveSheetId(),
        target,
        border,
    });
}
/**
 * Clear a cell
 */
export function clearCell(model, xc, sheetId = model.getters.getActiveSheetId()) {
    const [col, row] = toCartesian(xc);
    model.dispatch("CLEAR_CELL", { col, row, sheetId });
}
/**
 * Set the content of a cell
 */
export function setCellContent(model, xc, content, sheetId = model.getters.getActiveSheetId()) {
    const [col, row] = toCartesian(xc);
    return model.dispatch("UPDATE_CELL", { col, row, sheetId, content });
}
/**
 * Select a cell
 */
export function selectCell(model, xc) {
    const [col, row] = toCartesian(xc);
    return model.selection.selectCell(col, row);
}
export function moveAnchorCell(model, deltaCol, deltaRow) {
    return model.selection.moveAnchorCell(deltaCol, deltaRow);
}
export function resizeAnchorZone(model, deltaCol, deltaRow) {
    return model.selection.resizeAnchorZone(deltaCol, deltaRow);
}
export function setAnchorCorner(model, xc) {
    const [col, row] = toCartesian(xc);
    return model.selection.setAnchorCorner(col, row);
}
export function addCellToSelection(model, xc) {
    const [col, row] = toCartesian(xc);
    return model.selection.addCellToSelection(col, row);
}
/**
 * Move a conditianal formatting rule
 */
export function moveConditionalFormat(model, cfId, direction, sheetId) {
    return model.dispatch("MOVE_CONDITIONAL_FORMAT", {
        cfId: cfId,
        direction: direction,
        sheetId,
    });
}
export function setSelection(model, xcs, options = { anchor: undefined, strict: false }) {
    const sheetId = model.getters.getActiveSheetId();
    let zones = xcs
        .reverse()
        .map(toZone)
        .map((z) => model.getters.expandZone(sheetId, z));
    let anchor;
    if (options.anchor) {
        const [col, row] = toCartesian(options.anchor);
        // find the zones that contain the anchor and if several found ,select the last one as the anchorZone
        const anchorZoneIndex = zones.findIndex((zone) => isInside(col, row, zone));
        if (anchorZoneIndex === -1) {
            throw new Error(`Anchor cell ${options.anchor} should be inside a selected zone`);
        }
        const anchorZone = zones.splice(anchorZoneIndex, 1)[0]; // remove the zone from zones
        anchor = {
            cell: {
                col,
                row,
            },
            zone: anchorZone,
        };
    }
    else {
        const anchorZone = zones.splice(0, 1)[0]; // the default for most tests is to have the anchor as the first zone
        anchor = {
            cell: {
                col: anchorZone.left,
                row: anchorZone.top,
            },
            zone: anchorZone,
        };
    }
    if (zones.length !== 0) {
        const z1 = zones.splice(0, 1)[0];
        model.selection.selectZone({ cell: { col: z1.left, row: z1.top }, zone: z1 });
        for (const zone of zones) {
            model.selection.addCellToSelection(zone.left, zone.top);
            model.selection.setAnchorCorner(zone.right, zone.bottom);
        }
        model.selection.addCellToSelection(anchor.zone.left, anchor.zone.top);
        model.selection.setAnchorCorner(anchor.zone.right, anchor.zone.bottom);
    }
    else {
        model.selection.selectZone(anchor);
    }
}
export function selectColumn(model, col, mode) {
    return model.selection.selectColumn(col, mode);
}
export function selectRow(model, row, mode) {
    return model.selection.selectRow(row, mode);
}
export function selectAll(model) {
    return model.selection.selectAll();
}
export function sort(model, { zone, sheetId, anchor, direction, }) {
    const [col, row] = toCartesian(anchor);
    return model.dispatch("SORT_CELLS", {
        sheetId: sheetId || model.getters.getActiveSheetId(),
        zone: toZone(zone),
        col,
        row,
        sortDirection: direction,
    });
}
export function merge(model, range, sheetId = model.getters.getActiveSheetId()) {
    return model.dispatch("ADD_MERGE", {
        sheetId,
        target: target(range),
        force: true,
    });
}
export function interactiveMerge(model, range, sheetId = model.getters.getActiveSheetId()) {
    return model.dispatch("ADD_MERGE", {
        sheetId,
        target: target(range),
        force: false,
    });
}
export function unMerge(model, range, sheetId = model.getters.getActiveSheetId()) {
    return model.dispatch("REMOVE_MERGE", {
        sheetId,
        target: target(range),
    });
}
export function snapshot(model) {
    model["session"].snapshot(model.exportData());
}
//# sourceMappingURL=commands_helpers.js.map