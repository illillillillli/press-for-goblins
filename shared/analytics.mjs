export const ANALYTICS_METRICS = Object.freeze({
  page: new Set(['home', 'about', 'portfolio']),
  query_step: new Set(Array.from({ length: 12 }, (_, index) => String(index + 1))),
  query_complete: new Set(['yes']),
  gate: new Set(['yes', 'obviously', 'you have no idea', 'are you really goblins?']),
  writer_type: new Set(['novel', 'comic or graphic novel', 'video game', 'tabletop game', 'something else']),
  service: new Set(['creative development', 'narrative direction', 'editorial assessment', 'query/pitch feedback', 'writing', 'something else']),
  genre: new Set(['sci-fi', 'fantasy', 'horror', 'romance', 'genre blend', 'something else']),
  terms: new Set(["i'm in", 'i have questions']),
  interaction: new Set(['email_rune', 'linkedin', 'field_reports_signup']),
  opportunity: new Set(['email_rune', 'linkedin', 'field_reports_signup']),
  session: new Set(['start']),
  device: new Set(['mobile', 'desktop']),
  region: new Set(['GB', 'US', 'other', 'unknown']),
});

export function normaliseMetric(metric, value) {
  const safeMetric = typeof metric === 'string' ? metric : '';
  const safeValue = typeof value === 'string' ? value : '';
  return ANALYTICS_METRICS[safeMetric]?.has(safeValue)
    ? { metric: safeMetric, value: safeValue }
    : null;
}

export function parseCookies(header = '') {
  return String(header).split(';').reduce((result, pair) => {
    const separator = pair.indexOf('=');
    if (separator < 1) return result;
    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    if (name) result[name] = value;
    return result;
  }, {});
}
