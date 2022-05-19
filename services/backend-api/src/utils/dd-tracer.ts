import tracer from 'dd-trace';

tracer.init({
  logInjection: true,
});

export default tracer;
