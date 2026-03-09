//#Patterns: lint_suspicious_noDebugger

function processData(data) {
    //#Info: lint_suspicious_noDebugger
    debugger;
    return data;
}

function cleanData(data) {
    return data.trim();
}
