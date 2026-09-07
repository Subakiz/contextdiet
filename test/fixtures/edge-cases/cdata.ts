/**
 * CDATA escaping test with XML tags: <context_pack> <file> <summary>
 * And CDATA end markers: ]]> inside string literals and comments.
 */

export interface XmlContainer<T extends Record<string, unknown>> {
  payload: T;
  rawXmlSnippet: string;
}

export function escapeCdataSequence<T extends Record<string, unknown>>(data: T): XmlContainer<T> {
  // Contains tricky CDATA sequence
  const trickyString = 'Line with ]]> end marker and <nested><tags/></nested>';
  return {
    payload: data,
    rawXmlSnippet: trickyString
  };
}
