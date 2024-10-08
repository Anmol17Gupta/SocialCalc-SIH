import { _lt } from "../translation";
import { args } from "./arguments";
// -----------------------------------------------------------------------------
// ISERROR
// -----------------------------------------------------------------------------
export const ISERROR = {
    description: _lt("Whether a value is an error."),
    args: args(`value (any, lazy) ${_lt("The value to be verified as an error type.")}`),
    returns: ["BOOLEAN"],
    compute: function (value) {
        try {
            value();
            return false;
        }
        catch (e) {
            return true;
        }
    },
    isExported: true,
};
// -----------------------------------------------------------------------------
// ISLOGICAL
// -----------------------------------------------------------------------------
export const ISLOGICAL = {
    description: _lt("Whether a value is `true` or `false`."),
    args: args(`value (any) ${_lt("The value to be verified as a logical TRUE or FALSE.")}`),
    returns: ["BOOLEAN"],
    compute: function (value) {
        return typeof value === "boolean";
    },
    isExported: true,
};
// -----------------------------------------------------------------------------
// ISNONTEXT
// -----------------------------------------------------------------------------
export const ISNONTEXT = {
    description: _lt("Whether a value is non-textual."),
    args: args(`value (any) ${_lt("The value to be checked.")}`),
    returns: ["BOOLEAN"],
    compute: function (value) {
        return typeof value !== "string";
    },
    isExported: true,
};
// -----------------------------------------------------------------------------
// ISNUMBER
// -----------------------------------------------------------------------------
export const ISNUMBER = {
    description: _lt("Whether a value is a number."),
    args: args(`value (any) ${_lt("The value to be verified as a number.")}`),
    returns: ["BOOLEAN"],
    compute: function (value) {
        return typeof value === "number";
    },
    isExported: true,
};
// -----------------------------------------------------------------------------
// ISTEXT
// -----------------------------------------------------------------------------
export const ISTEXT = {
    description: _lt("Whether a value is text."),
    args: args(`value (any) ${_lt("The value to be verified as text.")}`),
    returns: ["BOOLEAN"],
    compute: function (value) {
        return typeof value === "string";
    },
    isExported: true,
};
//# sourceMappingURL=module_info.js.map