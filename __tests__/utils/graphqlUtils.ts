export const contextTest = (ctx: any) => {
  if (!ctx) ctx = {};
  ctx['req'] = { headers: [{ 'X-Correlation-ID': '123' }] };
  return ctx;
};
