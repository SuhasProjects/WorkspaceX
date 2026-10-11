import { TOKEN_NAMES, type ThemeTokens } from "../../lib/widget-protocol/theme";

export interface HostTheme {
  tokens: ThemeTokens;
  fontFaceCss: string;
  fontOrigin: string;
}

/**
 * Reads the dashboard's live styling from the element the widget is mounted
 * in, so widgets match whatever the host currently looks like.
 */
export function readHostTheme(element: Element): HostTheme {
  const computed = getComputedStyle(element);
  const tokens: ThemeTokens = {};
  for (const name of TOKEN_NAMES) {
    const value = computed.getPropertyValue(name).trim();
    if (value) tokens[name] = value;
  }
  if (!tokens["--wz-font"] && computed.fontFamily) tokens["--wz-font"] = computed.fontFamily;
  if (!tokens["--wz-font-display"]) {
    const heading = element.ownerDocument.querySelector("h1, h2");
    const family = heading ? getComputedStyle(heading).fontFamily : computed.fontFamily;
    if (family) tokens["--wz-font-display"] = family;
  }
  if (!tokens["--wz-radius"]) {
    const button = element.ownerDocument.querySelector('button[type="submit"], button:not([class*="icon"])');
    const radius = button ? getComputedStyle(button).borderRadius : "";
    if (radius && radius !== "0px") tokens["--wz-radius"] = radius;
  }

  const fontFaces: string[] = [];
  for (const sheet of Array.from(element.ownerDocument.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // Cross-origin stylesheet; nothing we can copy.
    }
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSFontFaceRule) fontFaces.push(rule.cssText);
    }
  }

  return { tokens, fontFaceCss: fontFaces.join("\n"), fontOrigin: window.location.origin };
}
