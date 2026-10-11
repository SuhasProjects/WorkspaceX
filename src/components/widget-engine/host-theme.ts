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
  const heading = element.ownerDocument.querySelector("h2, h1");
  if (heading) {
    const headingStyle = getComputedStyle(heading);
    if (!tokens["--wz-font-display"] && headingStyle.fontFamily) tokens["--wz-font-display"] = headingStyle.fontFamily;
    if (!tokens["--wz-heading-weight"] && headingStyle.fontWeight) tokens["--wz-heading-weight"] = headingStyle.fontWeight;
    if (!tokens["--wz-heading-spacing"] && headingStyle.letterSpacing && headingStyle.letterSpacing !== "normal") {
      tokens["--wz-heading-spacing"] = headingStyle.letterSpacing;
    }
  }
  if (!tokens["--wz-font-display"] && computed.fontFamily) tokens["--wz-font-display"] = computed.fontFamily;
  // The dashboard names its glass/inset/hover surfaces without the wz- prefix.
  const aliases = [["--glass", "--wz-glass"], ["--inset", "--wz-inset"], ["--hover", "--wz-hover"]] as const;
  for (const [hostName, tokenName] of aliases) {
    const value = computed.getPropertyValue(hostName).trim();
    if (value && !tokens[tokenName]) tokens[tokenName] = value;
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
