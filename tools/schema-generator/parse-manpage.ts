// tools/schema-generator/parse-manpage.ts

import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';
import { ManPageDef, SectionDef, OptionDef } from './types';
import { inferOption } from './infer';

export function parseManPage(
  file: string,
  unit: 'network' | 'netdev' | 'link'
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

    // Find description text between h2 and dl
    let sectionDescription = '';
    let sibling = h2.nextElementSibling;
    const dl = h2.parentElement?.querySelector('dl.variablelist'); // This might be further down?

    // Actually, in the structure, h2 and the p's and dl are usually siblings in refsect1
    // or h2 is child of refsect1, and p's and dl are siblings.
    // The previous code found dl via h2.parentElement.querySelector.

    // Let's traverse siblings of h2 until we hit the dl or another h2
    while (sibling && sibling !== dl && sibling.tagName !== 'H2') {
      sectionDescription += sibling.textContent + ' ';
      sibling = sibling.nextElementSibling;
    }

    sectionDescription = sectionDescription.replace(/\s+/g, ' ').trim();
    const multiple = /Specify several .* sections/i.test(sectionDescription) ||
      /can be specified more than once/i.test(sectionDescription) ||
      /may be specified more than once/i.test(sectionDescription);

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
        types: inferred.types,
        enumValues: inferred.enumValues,
        multiple: inferred.multiple,
        default: inferred.default,
        since,
      });
    }

    sections.push({
      name: sectionName,
      description: sectionDescription,
      multiple,
      options,
    });
  }

  return { unit, sections };
}
