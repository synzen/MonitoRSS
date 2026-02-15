interface MessageBuilderProblem {
  message: string;
  path: string;
  componentId: string;
  severity: "error" | "warning";
}

export default MessageBuilderProblem;
