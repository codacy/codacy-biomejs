//#Patterns: lint_suspicious_noDoubleEquals

function compare(a, b) {
    //#Info: lint_suspicious_noDoubleEquals
    if (a == b) {
        return true;
    }
    return false;
}

function isZero(x) {
    //#Info: lint_suspicious_noDoubleEquals
    return x == 0;
}
