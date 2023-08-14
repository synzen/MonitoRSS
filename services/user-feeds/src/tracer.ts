import tracer from "dd-trace";
tracer.init({
  logInjection: true,
}); // initialized in a different file to avoid hoisting.
export default tracer;
