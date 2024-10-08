/**
 * An Operation can be executed to change a data structure from state A
 * to state B.
 * It should hold the necessary data used to perform this transition.
 * It should be possible to revert the changes made by this operation.
 *
 * In the context of o-spreadsheet, the data from an operation would
 * be a revision (the commands are used to execute it, the `changes` are used
 * to revert it).
 */
export class Operation {
    constructor(id, data) {
        this.id = id;
        this.data = data;
    }
    transformed(transformation) {
        return new Operation(this.id, transformation(this.data));
    }
}
//# sourceMappingURL=operation.js.map