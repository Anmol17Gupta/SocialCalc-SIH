import { Component, onMounted, onWillUnmount, useExternalListener, useState, useSubEnv, xml, } from "@odoo/owl";
import { BOTTOMBAR_HEIGHT, CF_ICON_EDGE_LENGTH, ICON_EDGE_LENGTH, TOPBAR_HEIGHT, } from "../constants";
import { BottomBar } from "./bottom_bar";
import { Grid } from "./grid";
import { css } from "./helpers/css";
import { LinkEditor } from "./link/link_editor";
import { SidePanel } from "./side_panel/side_panel";
import { TopBar } from "./top_bar";
const TEMPLATE = xml /* xml */ `
  <div class="o-spreadsheet"  t-on-keydown="onKeydown">
    <TopBar
      onClick="() => this.focusGrid()"
      onComposerContentFocused="(selection) => this.onTopBarComposerFocused(selection)"
      focusComposer="focusTopBarComposer"/>
    <Grid
      sidePanelIsOpen="sidePanel.isOpen"
      linkEditorIsOpen="linkEditor.isOpen"
      onLinkEditorClosed="() => this.closeLinkEditor()"
      onSaveRequested="() => this.save()"
      focusComposer="focusGridComposer"
      exposeFocus="(focus) => this._focusGrid = focus"
      onComposerContentFocused="() => this.onGridComposerContentFocused()"
      onGridComposerCellFocused="(content, selection) => this.onGridComposerCellFocused(content, selection)"/>
    <SidePanel t-if="sidePanel.isOpen"
      onCloseSidePanel="() => this.closeSidePanel()"
      component="sidePanel.component"
      panelProps="sidePanel.panelProps"/>
    <BottomBar onClick="() => this.focusGrid()"/>
  </div>`;
css /* scss */ `
  .o-spreadsheet {
    position: relative;
    display: grid;
    grid-template-rows: ${TOPBAR_HEIGHT}px auto ${BOTTOMBAR_HEIGHT + 1}px;
    grid-template-columns: auto 350px;
    * {
      font-family: "Roboto", "RobotoDraft", Helvetica, Arial, sans-serif;
    }
    &,
    *,
    *:before,
    *:after {
      box-sizing: content-box;
    }
  }

  .o-two-columns {
    grid-column: 1 / 3;
  }

  .o-icon {
    width: ${ICON_EDGE_LENGTH}px;
    height: ${ICON_EDGE_LENGTH}px;
    opacity: 0.6;
    vertical-align: middle;
  }

  .o-cf-icon {
    width: ${CF_ICON_EDGE_LENGTH}px;
    height: ${CF_ICON_EDGE_LENGTH}px;
    vertical-align: sub;
  }
`;
const t = (s) => s;
export class Spreadsheet extends Component {
    setup() {
        var _a, _b;
        (_b = (_a = this.props).exposeSpreadsheet) === null || _b === void 0 ? void 0 : _b.call(_a, this);
        this.model = this.props.model;
        this.sidePanel = useState({ isOpen: false, panelProps: {} });
        this.linkEditor = useState({ isOpen: false });
        this.composer = useState({
            topBarFocus: "inactive",
            gridFocusMode: "inactive",
        });
        this.keyDownMapping = {
            "CTRL+H": () => this.toggleSidePanel("FindAndReplace", {}),
            "CTRL+F": () => this.toggleSidePanel("FindAndReplace", {}),
        };
        useSubEnv({
            model: this.model,
            openSidePanel: this.openSidePanel.bind(this),
            toggleSidePanel: this.toggleSidePanel.bind(this),
            openLinkEditor: this.openLinkEditor.bind(this),
            _t: Spreadsheet._t,
            clipboard: navigator.clipboard,
        });
        useExternalListener(window, "resize", this.render);
        useExternalListener(document.body, "keyup", this.onKeyup.bind(this));
        useExternalListener(window, "beforeunload", this.unbindModelEvents.bind(this));
        onMounted(() => this.bindModelEvents());
        onWillUnmount(() => this.unbindModelEvents());
    }
    get focusTopBarComposer() {
        return this.model.getters.getEditionMode() === "inactive"
            ? "inactive"
            : this.composer.topBarFocus;
    }
    get focusGridComposer() {
        return this.model.getters.getEditionMode() === "inactive"
            ? "inactive"
            : this.composer.gridFocusMode;
    }
    bindModelEvents() {
        this.model.on("update", this, this.render);
        this.model.on("notify-ui", this, this.onNotifyUI);
    }
    unbindModelEvents() {
        this.model.off("update", this);
        this.model.off("notify-ui", this);
    }
    onNotifyUI(payload) {
        switch (payload.type) {
            case "NOTIFICATION":
                this.env.notifyUser(payload.text);
                break;
        }
    }
    openSidePanel(panel, panelProps) {
        this.sidePanel.component = panel;
        this.sidePanel.panelProps = panelProps;
        this.sidePanel.isOpen = true;
    }
    closeSidePanel() {
        this.sidePanel.isOpen = false;
        this.focusGrid();
    }
    openLinkEditor() {
        this.linkEditor.isOpen = true;
    }
    closeLinkEditor() {
        this.linkEditor.isOpen = false;
        this.focusGrid();
    }
    toggleSidePanel(panel, panelProps) {
        if (this.sidePanel.isOpen && panel === this.sidePanel.component) {
            this.sidePanel.isOpen = false;
            this.focusGrid();
        }
        else {
            this.openSidePanel(panel, panelProps);
        }
    }
    focusGrid() {
        if (!this._focusGrid) {
            throw new Error("_focusGrid should be exposed by the grid component");
        }
        this._focusGrid();
    }
    save() {
        var _a, _b;
        (_b = (_a = this.props).onContentSaved) === null || _b === void 0 ? void 0 : _b.call(_a, this.model.exportData());
    }
    onKeyup(ev) {
        if (ev.key === "Control") {
            this.model.dispatch("STOP_SELECTION_INPUT");
        }
    }
    onKeydown(ev) {
        if (ev.key === "Control" && !ev.repeat) {
            this.model.dispatch("PREPARE_SELECTION_INPUT_EXPANSION");
        }
        let keyDownString = "";
        if (ev.ctrlKey || ev.metaKey) {
            keyDownString += "CTRL+";
        }
        keyDownString += ev.key.toUpperCase();
        let handler = this.keyDownMapping[keyDownString];
        if (handler) {
            ev.preventDefault();
            ev.stopPropagation();
            handler();
            return;
        }
    }
    onTopBarComposerFocused(selection) {
        if (this.model.getters.isReadonly()) {
            return;
        }
        this.model.dispatch("UNFOCUS_SELECTION_INPUT");
        this.composer.topBarFocus = "contentFocus";
        this.composer.gridFocusMode = "inactive";
        this.setComposerContent({ selection } || {});
    }
    onGridComposerContentFocused() {
        if (this.model.getters.isReadonly()) {
            return;
        }
        this.model.dispatch("UNFOCUS_SELECTION_INPUT");
        this.composer.topBarFocus = "inactive";
        this.composer.gridFocusMode = "contentFocus";
        this.setComposerContent({});
    }
    onGridComposerCellFocused(content, selection) {
        if (this.model.getters.isReadonly()) {
            return;
        }
        this.model.dispatch("UNFOCUS_SELECTION_INPUT");
        this.composer.topBarFocus = "inactive";
        this.composer.gridFocusMode = "cellFocus";
        this.setComposerContent({ content, selection } || {});
    }
    /**
     * Start the edition or update the content if it's already started.
     */
    setComposerContent({ content, selection, }) {
        if (this.model.getters.getEditionMode() === "inactive") {
            this.model.dispatch("START_EDITION", { text: content, selection });
        }
        else if (content) {
            this.model.dispatch("SET_CURRENT_CONTENT", { content, selection });
        }
    }
}
Spreadsheet.template = TEMPLATE;
Spreadsheet.components = { TopBar, Grid, BottomBar, SidePanel, LinkEditor };
Spreadsheet._t = t;
//# sourceMappingURL=spreadsheet.js.map