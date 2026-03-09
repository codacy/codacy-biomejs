/**
 * Logging Utilities Module
 * 
 * Usage:
 * - Set the `DEBUG` environment variable to true to enable debug logging.
 * - Use the `debug` function to log any message when debugging is enabled.
 * - Use the `debugWhen` function to conditionally log a message based on a boolean condition.
 * - Use the `debugEither` function to log one of two messages based on the evaluation of a boolean condition.
  * 
 */

export const DEBUG: boolean = Boolean(process.env.DEBUG);

export type LoggingMessageType =
| null
| string
| number
| boolean
| object;

/* eslint-disable no-unused-vars */
export enum TerminalColor {
  Black = 30,
  Red = 31,
  Green = 32,
  Yellow = 33,
  Blue = 34,
  Magenta = 35,
  Cyan = 36,
  White = 37,
  BrightBlack = 90, // Gray
  BrightRed = 91,
  BrightGreen = 92,
  BrightYellow = 93,
  BrightBlue = 94,
  BrightMagenta = 95,
  BrightCyan = 96,
  BrightWhite = 97
};
/* eslint-enable no-unused-vars */

const PREFIX = wrapConsoleTextInColor("[DEBUG]", TerminalColor.Cyan);

/**
 * Logs one or more debug messages if debugging is enabled.
 * 
 * @param msgs - The messages to log. Can be of any type defined in `LoggingMessageType`.
 */
export function debug(...msgs: LoggingMessageType[]): void {
  if (!DEBUG) return;

  msgs.forEach((msg) => {
    if (msg === null) {
      console.log(PREFIX, "null");
      return;
    }
    
    switch (typeof msg) {
      case "object":
        console.log(PREFIX);
        console.dir(msg, { depth: null });
        return;
      case "string":
      case "number":
      case "boolean":
        console.log(PREFIX, msg);
        return;
    }
  });
}

/**
 * Logs a message if a condition is true and debugging is enabled.
 * 
 * @param cond The condition to check.
 * @param msg The message to potentially log.
 */
export function debugWhen(cond: boolean, msg: LoggingMessageType): void {
  if (cond) debug(msg);
}

/**
 * Logs a message based on the evaluation of a condition.
 * 
 * @param cond - The condition to evaluate.
 * @param msgTrue - The message to log if the condition is true.
 * @param msgFalse - The message to log if the condition is false.
 */
export function debugEither(cond: boolean, msgTrue: LoggingMessageType, msgFalse: LoggingMessageType): void {
  cond ? debug(msgTrue) : debug(msgFalse);
}

/**
 * Wraps the given text message in ANSI color codes for console output.
 * 
 * @param msg - The message text to be colored.
 * @param color - The ANSI color code to apply to the message.
 * @returns The message wrapped in the specified ANSI color code.
 */

export function wrapConsoleTextInColor(msg: string, color: TerminalColor): string {
  return `\x1b[${color}m${msg}\x1b[0m`;
}