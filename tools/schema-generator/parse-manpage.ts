// tools/schema-generator/parse-manpage.ts

import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';
import { ManPageDef, SectionDef, OptionDef } from './types';
import { inferOption } from './infer';

export function parseManPage(
  file: string,
  unit: 'network' | 'netdev'
): ManPageDef {
  const html = readFileSync(file, 'utf8');
  const dom = new JSDOM(html);
  const document = dom.window.document;

  const sections: SectionDef[] = [];

  const h2s = Array.from(document.querySelectorAll('h2'));

  for (const h2 of h2s) {
    const title = h2.textContent?.trim();
    if (!title) continue;

    const match = title.match(/^\[(.+)]/);
    if (!match) continue;

    const sectionName = match[1];
    const dl = h2.parentElement?.querySelector('dl.variablelist');
    if (!dl) continue;

    const options: OptionDef[] = [];

    const dts = Array.from(dl.querySelectorAll('dt'));
    for (const dt of dts) {
      const code = dt.querySelector('code.varname');
      if (!code) continue;

      const key = code.textContent?.replace(/=$/, '');
      if (!key) continue;

      const dd = dt.nextElementSibling;
      if (!dd) continue;

      const description = dd.textContent
        ?.replace(/\s+/g, ' ')
        .trim() ?? '';

      const sinceMatch = dd.innerHTML.match(/Added in version ([0-9.]+)/);
      const since = sinceMatch?.[1];

      const inferred = inferOption(key, description);

      options.push({
        key,
        description,
        type: inferred.type,
        enumValues: inferred.enumValues,
        multiple: inferred.multiple,
        since,
      });
    }

    sections.push({
      name: sectionName,
      options,
    });
  }

  return { unit, sections };
}
