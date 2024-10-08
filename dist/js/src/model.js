import { markRaw } from "@odoo/owl";
import { LocalTransportService } from "./collaborative/local_transport_service";
import { Session } from "./collaborative/session";
import { DEFAULT_REVISION_ID } from "./constants";
import { DataSourceRegistry } from "./data_source";
import { EventBus } from "./helpers/event_bus";
import { UuidGenerator } from "./helpers/index";
import { buildRevisionLog } from "./history/factory";
import { LocalHistory } from "./history/local_history";
import { createEmptyExcelWorkbookData, createEmptyWorkbookData, load } from "./migrations/data";
import { RangeAdapter } from "./plugins/core/range";
import { CorePlugin } from "./plugins/core_plugin";
import { corePluginRegistry, uiPluginRegistry } from "./plugins/index";
import { SelectionStreamProcessor } from "./selection_stream/selection_stream_processor";
import { StateObserver } from "./state_observer";
import { _lt } from "./translation";
import { canExecuteInReadonly, DispatchResult, isCoreCommand, } from "./types/index";
import { getXLSX } from "./xlsx/xlsx_writer";
var Status;
(function (Status) {
    Status[Status["Ready"] = 0] = "Ready";
    Status[Status["Running"] = 1] = "Running";
    Status[Status["RunningCore"] = 2] = "RunningCore";
    Status[Status["Finalizing"] = 3] = "Finalizing";
})(Status || (Status = {}));
export class Model extends EventBus {
    constructor(data = {}, config = {}, stateUpdateMessages = [], uuidGenerator = new UuidGenerator()) {
        super();
        this.corePlugins = [];
        this.uiPlugins = [];
        this.dataSources = new DataSourceRegistry();
        /**
         * A plugin can draw some contents on the canvas. But even better: it can do
         * so multiple times.  The order of the render calls will determine a list of
         * "layers" (i.e., earlier calls will be obviously drawn below later calls).
         * This list simply keeps the renderers+layer information so the drawing code
         * can just iterate on it
         */
        this.renderers = [];
        /**
         * Internal status of the model. Important for command handling coordination
         */
        this.status = 0 /* Ready */;
        /**
         * The dispatch method is the only entry point to manipulate data in the model.
         * This is through this method that commands are dispatched most of the time
         * recursively until no plugin want to react anymore.
         *
         * CoreCommands dispatched from this function are saved in the history.
         *
         * Small technical detail: it is defined as an arrow function.  There are two
         * reasons for this:
         * 1. this means that the dispatch method can be "detached" from the model,
         *    which is done when it is put in the environment (see the Spreadsheet
         *    component)
         * 2. This allows us to define its type by using the interface CommandDispatcher
         */
        this.dispatch = (type, payload) => {
            const command = { type, ...payload };
            let status = this.status;
            if (this.config.isReadonly && !canExecuteInReadonly(command)) {
                return new DispatchResult(50 /* Readonly */);
            }
            switch (status) {
                case 0 /* Ready */:
                    const result = this.checkDispatchAllowed(command);
                    if (!result.isSuccessful) {
                        return result;
                    }
                    this.status = 1 /* Running */;
                    const { changes, commands } = this.state.recordChanges(() => {
                        if (isCoreCommand(command)) {
                            this.state.addCommand(command);
                        }
                        this.dispatchToHandlers(this.handlers, command);
                        this.finalize();
                    });
                    this.session.save(commands, changes);
                    this.status = 0 /* Ready */;
                    if (this.config.mode !== "headless") {
                        this.trigger("update");
                    }
                    break;
                case 1 /* Running */:
                    if (isCoreCommand(command)) {
                        const dispatchResult = this.checkDispatchAllowed(command);
                        if (!dispatchResult.isSuccessful) {
                            return dispatchResult;
                        }
                        this.state.addCommand(command);
                        this.dispatchToHandlers(this.handlers, command);
                    }
                    else {
                        this.dispatchToHandlers(this.handlers, command);
                    }
                    break;
                case 3 /* Finalizing */:
                    throw new Error(_lt("Cannot dispatch commands in the finalize state"));
                case 2 /* RunningCore */:
                    throw new Error("A UI plugin cannot dispatch while handling a core command");
            }
            return DispatchResult.Success;
        };
        /**
         * Dispatch a command from a Core Plugin (or the History).
         * A command dispatched from this function is not added to the history.
         */
        this.dispatchFromCorePlugin = (type, payload) => {
            const command = { type, ...payload };
            const previousStatus = this.status;
            this.status = 2 /* RunningCore */;
            this.dispatchToHandlers(this.handlers, command);
            this.status = previousStatus;
            return DispatchResult.Success;
        };
        const workbookData = load(data);
        this.state = new StateObserver();
        this.uuidGenerator = uuidGenerator;
        this.config = this.setupConfig(config);
        this.session = this.setupSession(workbookData.revisionId);
        this.config.moveClient = this.session.move.bind(this.session);
        this.history = new LocalHistory(this.dispatchFromCorePlugin, this.session);
        this.getters = {
            isReadonly: () => this.config.isReadonly,
            canUndo: this.history.canUndo.bind(this.history),
            canRedo: this.history.canRedo.bind(this.history),
            getClient: this.session.getClient.bind(this.session),
            getConnectedClients: this.session.getConnectedClients.bind(this.session),
            isFullySynchronized: this.session.isFullySynchronized.bind(this.session),
        };
        this.range = new RangeAdapter(this.getters);
        this.getters.getRangeString = this.range.getRangeString.bind(this.range);
        this.getters.getRangeFromSheetXC = this.range.getRangeFromSheetXC.bind(this.range);
        this.getters.createAdaptedRanges = this.range.createAdaptedRanges.bind(this.range);
        this.uuidGenerator.setIsFastStrategy(true);
        // Initiate stream processor
        this.selection = new SelectionStreamProcessor(this.getters);
        // registering plugins
        for (let Plugin of corePluginRegistry.getAll()) {
            this.setupCorePlugin(Plugin, workbookData);
        }
        for (let Plugin of uiPluginRegistry.getAll()) {
            this.setupUiPlugin(Plugin);
        }
        this.uuidGenerator.setIsFastStrategy(false);
        // starting plugins
        this.dispatch("START");
        // Model should be the last permanent subscriber in the list since he should render
        // after all changes have been applied to the other subscribers (plugins)
        this.selection.observe(this, {
            handleEvent: () => this.trigger("update"),
        });
        // This should be done after construction of LocalHistory due to order of
        // events
        this.setupSessionEvents();
        // Load the initial revisions
        this.session.loadInitialMessages(stateUpdateMessages);
        this.joinSession();
        if (config.snapshotRequested) {
            this.session.snapshot(this.exportData());
        }
        // mark all models as "raw", so they will not be turned into reactive objects
        // by owl, since we do not rely on reactivity
        markRaw(this);
    }
    get handlers() {
        return [this.range, ...this.corePlugins, ...this.uiPlugins, this.history];
    }
    joinSession() {
        this.session.join(this.config.client);
    }
    leaveSession() {
        this.session.leave();
    }
    setupUiPlugin(Plugin) {
        if (Plugin.modes.includes(this.config.mode)) {
            const plugin = new Plugin(this.getters, this.state, this.dispatch, this.config, this.selection);
            for (let name of Plugin.getters) {
                if (!(name in plugin)) {
                    throw new Error(`Invalid getter name: ${name} for plugin ${plugin.constructor}`);
                }
                this.getters[name] = plugin[name].bind(plugin);
            }
            this.uiPlugins.push(plugin);
            const layers = Plugin.layers.map((l) => [plugin, l]);
            this.renderers.push(...layers);
            this.renderers.sort((p1, p2) => p1[1] - p2[1]);
        }
    }
    /**
     * Initialize and properly configure a plugin.
     *
     * This method is private for now, but if the need arise, there is no deep
     * reason why the model could not add dynamically a plugin while it is running.
     */
    setupCorePlugin(Plugin, data) {
        if (Plugin.modes.includes(this.config.mode)) {
            const plugin = new Plugin(this.getters, this.state, this.range, this.dispatchFromCorePlugin, this.config, this.uuidGenerator);
            for (let name of Plugin.getters) {
                if (!(name in plugin)) {
                    throw new Error(`Invalid getter name: ${name} for plugin ${plugin.constructor}`);
                }
                this.getters[name] = plugin[name].bind(plugin);
            }
            plugin.import(data);
            this.corePlugins.push(plugin);
        }
    }
    onRemoteRevisionReceived({ commands }) {
        for (let command of commands) {
            this.dispatchToHandlers(this.uiPlugins, command);
        }
        this.finalize();
    }
    setupSession(revisionId) {
        const session = new Session(buildRevisionLog(revisionId, this.state.recordChanges.bind(this.state), (command) => this.dispatchToHandlers([this.range, ...this.corePlugins], command)), this.config.transportService, revisionId);
        return session;
    }
    setupSessionEvents() {
        this.session.on("remote-revision-received", this, this.onRemoteRevisionReceived);
        this.session.on("revision-redone", this, this.finalize);
        this.session.on("revision-undone", this, this.finalize);
        // How could we improve communication between the session and UI?
        // It feels weird to have the model piping specific session events to its own bus.
        this.session.on("unexpected-revision-id", this, () => this.trigger("unexpected-revision-id"));
        this.session.on("collaborative-event-received", this, () => {
            this.trigger("update");
        });
    }
    setupConfig(config) {
        const client = config.client || {
            id: this.uuidGenerator.uuidv4(),
            name: _lt("Anonymous").toString(),
        };
        const transportService = config.transportService || new LocalTransportService();
        return {
            ...config,
            mode: config.mode || "normal",
            evalContext: config.evalContext || {},
            transportService,
            client,
            moveClient: () => { },
            isHeadless: config.mode === "headless" || false,
            isReadonly: config.isReadonly || false,
            snapshotRequested: false,
            dataSources: this.dataSources,
            notifyUI: (payload) => this.trigger("notify-ui", payload),
        };
    }
    // ---------------------------------------------------------------------------
    // Command Handling
    // ---------------------------------------------------------------------------
    /**
     * Check if the given command is allowed by all the plugins and the history.
     */
    checkDispatchAllowed(command) {
        const results = this.handlers.map((handler) => handler.allowDispatch(command));
        return new DispatchResult(results.flat());
    }
    finalize() {
        this.status = 3 /* Finalizing */;
        for (const h of this.handlers) {
            h.finalize();
        }
        this.status = 0 /* Ready */;
    }
    /**
     * Dispatch the given command to the given handlers.
     * It will call `beforeHandle` and `handle`
     */
    dispatchToHandlers(handlers, command) {
        for (const handler of handlers) {
            handler.beforeHandle(command);
        }
        for (const handler of handlers) {
            handler.handle(command);
        }
    }
    // ---------------------------------------------------------------------------
    // Grid Rendering
    // ---------------------------------------------------------------------------
    /**
     * When the Grid component is ready (= mounted), it has a reference to its
     * canvas and need to draw the grid on it.  This is then done by calling this
     * method, which will dispatch the call to all registered plugins.
     *
     * Note that nothing prevents multiple grid components from calling this method
     * each, or one grid component calling it multiple times with a different
     * context. This is probably the way we should do if we want to be able to
     * freeze a part of the grid (so, we would need to render different zones)
     */
    drawGrid(context) {
        // we make sure here that the viewport is properly positioned: the offsets
        // correspond exactly to a cell
        for (let [renderer, layer] of this.renderers) {
            context.ctx.save();
            renderer.drawGrid(context, layer);
            context.ctx.restore();
        }
    }
    // ---------------------------------------------------------------------------
    // Data Export
    // ---------------------------------------------------------------------------
    /**
     * As the name of this method strongly implies, it is useful when we need to
     * export date out of the model.
     */
    exportData() {
        let data = createEmptyWorkbookData();
        for (let handler of this.handlers) {
            if (handler instanceof CorePlugin) {
                handler.export(data);
            }
        }
        data.revisionId = this.session.getRevisionId() || DEFAULT_REVISION_ID;
        data = JSON.parse(JSON.stringify(data));
        return data;
    }
    /**
     * Change the configuration of the model to put it in readonly or read-write mode
     * @param isReadonly
     */
    updateReadOnly(isReadonly) {
        if (isReadonly) {
            this.dispatch("STOP_EDITION", { cancel: true });
        }
        this.config.isReadonly = isReadonly || false;
        this.trigger("update");
    }
    /**
     * Wait until all cells that depends on dataSources in spreadsheet are computed
     */
    waitForIdle() {
        return this.dataSources.waitForReady();
    }
    /**
     * Exports the current model data into a list of serialized XML files
     * to be zipped together as an *.xlsx file.
     *
     * We need to trigger a cell revaluation  on every sheet and ensure that even
     * async functions are evaluated.
     * This prove to be necessary if the client did not trigger that evaluation in the first place
     * (e.g. open a document with several sheet and click on download before visiting each sheet)
     */
    async exportXLSX() {
        await this.waitForIdle();
        this.dispatch("EVALUATE_ALL_SHEETS");
        let data = createEmptyExcelWorkbookData();
        for (let handler of this.handlers) {
            if (handler instanceof CorePlugin) {
                handler.exportForExcel(data);
            }
        }
        data = JSON.parse(JSON.stringify(data));
        return getXLSX(data);
    }
}
//# sourceMappingURL=model.js.map